/* 线路实测页：测首屏、登录、实时推送，结束后把数字上传到 probe_results 并在屏幕上显示摘要。
 * 只请求同源地址；不收集个人信息（没有自由文本，不上传 UA 原文，不上传 IP）；页面文字一律用 textContent 写入。
 * 上传字段以 tools/probe/schema.json 为准，由 schema-check.mjs --page 比对下面两个常量。 */
(function () {
  'use strict';

  const RESULT_FIELDS = [
    'run_id',
    'carrier',
    'net',
    'browser',
    'started_at',
    'tz_offset_min',
    'dur_s',
    'nav_type',
    'fs_src',
    'first_screen_ms',
    'ttfb_ms',
    'load_ms',
    'dns_ms',
    'connect_ms',
    'tls_ms',
    'sdk_ms',
    'api_rtt_ms',
    'login_ms',
    'login_ok',
    'rt_connect_ms',
    'hidden_ms',
    'drops',
    'max_reconnect_ms',
    'pings_ok',
    'pings_total',
    'push_ms',
    'events',
  ];
  const PING_FIELDS = ['run', 'seq'];

  // 打点计划（秒，相对实时连接开始）。相邻打点最长安静 180 秒，所以它测的是“安静不超过 180 秒时推送是否丢失”；
  // 服务器 5 分钟空闲断开不由打点直接测到，只能从记录下来的 drop 和 reconnect 事件里间接看到。
  const PING_PLAN = [15, 45, 105, 195, 315, 495];
  const PING_WAIT_MS = 15000;
  const EVENTS_MAX = 200;
  const UPLOAD_RETRIES = 3;
  const UPLOAD_GAP_MS = 2000;

  const CARRIER_NAME = { telecom: '电信', unicom: '联通', mobile: '移动', us: '美国' };
  const NET_NAME = { cell4g: '手机 4G', home: '家宽', other: '其他' };

  const $ = (id) => document.getElementById(id);
  const elStart = $('start');
  const elStatus = $('status');
  const elLeft = $('left');
  const elSummary = $('summary');
  const elShot = $('shot');

  const say = (t) => {
    elStatus.textContent = t;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const median = (a) => {
    const s = a.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y);
    if (s.length === 0) return null;
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  };
  // 数字字段：取整、不小于 0、必须是有限数；否则当作没有测到
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0, v)) : undefined);
  const checked = (name) => {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  };

  // ?dur= 只允许 60 到 600 之间的整数，默认 600
  const durParam = new URLSearchParams(location.search).get('dur');
  const DUR = durParam !== null && /^\d+$/.test(durParam) ? Math.min(600, Math.max(60, parseInt(durParam, 10))) : 600;

  const ready = typeof PocketBase === 'function' && !!window.PROBE_CONFIG && typeof window.PROBE_CONFIG.email === 'string' && typeof window.PROBE_CONFIG.password === 'string';
  let running = false;

  const radios = Array.prototype.slice.call(document.querySelectorAll('input[type="radio"]'));
  const sync = () => {
    elStart.disabled = !ready || running || !checked('carrier') || !checked('net');
  };
  radios.forEach((r) => r.addEventListener('change', sync));
  if (!ready) say('页面配置缺失，请联系组织测试的人。');
  sync();

  // UA 只粗分，原文不上传
  const browserOf = () => {
    const ua = navigator.userAgent || '';
    if (/MicroMessenger/i.test(ua)) return 'wechat';
    if (/Edg(e|A|iOS)?\//i.test(ua)) return 'edge';
    if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
    if (/Chrome|CriOS/i.test(ua)) return 'chrome';
    if (/Safari/i.test(ua)) return 'safari';
    return 'other';
  };

  // 首屏和分段耗时：点“开始”时绘制和导航条目早已存在
  const readTimings = () => {
    const t = {};
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcp) {
        t.first_screen_ms = fcp.startTime;
        t.fs_src = 'fcp';
      } else if (nav) {
        t.first_screen_ms = nav.domContentLoadedEventEnd;
        t.fs_src = 'dcl';
      }
      if (nav) {
        t.nav_type = nav.type;
        t.ttfb_ms = nav.responseStart;
        t.dns_ms = nav.domainLookupEnd - nav.domainLookupStart;
        t.connect_ms = nav.connectEnd - nav.connectStart;
        t.tls_ms = nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : null;
        t.load_ms = nav.loadEventEnd;
      }
      const sdk = performance.getEntriesByName(new URL('vendor/pocketbase.iife.js', location.href).href)[0];
      if (sdk) t.sdk_ms = sdk.duration;
    } catch (e) {}
    return t;
  };

  // 接口往返：连续 5 次，取中位数
  const measureRtt = async () => {
    const xs = [];
    for (let i = 0; i < 5; i += 1) {
      const a = performance.now();
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) xs.push(performance.now() - a);
      } catch (e) {}
    }
    return median(xs);
  };

  const run = async () => {
    running = true;
    radios.forEach((r) => {
      r.disabled = true;
    });
    sync();
    elSummary.hidden = true;
    elShot.hidden = true;

    const carrier = checked('carrier');
    const net = checked('net');
    const RUN_ID = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    const m = { run_id: RUN_ID, carrier, net, browser: browserOf(), started_at: new Date().toISOString(), tz_offset_min: -new Date().getTimezoneOffset() };
    Object.assign(m, readTimings());

    // 前台：累计页面不可见的时长，并尽量保持屏幕常亮
    let hiddenMs = 0;
    let hiddenSince = document.hidden ? performance.now() : null;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (hiddenSince === null) hiddenSince = performance.now();
      } else if (hiddenSince !== null) {
        hiddenMs += performance.now() - hiddenSince;
        hiddenSince = null;
      }
    });
    try {
      if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
    } catch (e) {}

    say('测接口往返……');
    m.api_rtt_ms = await measureRtt();

    const pb = new PocketBase('/');
    pb.autoCancellation(false);
    pb.authStore.clear();

    // 登录：每次真登录，计时
    say('登录中……');
    const l0 = performance.now();
    let loginOk = false;
    try {
      await pb.collection('users').authWithPassword(window.PROBE_CONFIG.email, window.PROBE_CONFIG.password);
      loginOk = true;
    } catch (e) {}
    m.login_ms = performance.now() - l0;
    m.login_ok = loginOk;

    // 实时：登录成功才继续；记掉线、重连和自写自收的推送
    const events = [];
    let drops = 0;
    let maxReconnect = 0;
    let dropAt = null;
    let firstConnectAt = null;
    let closing = false;
    const pushMs = [];
    let pingsOk = 0;
    let t0 = performance.now();
    const sec = () => Math.round(((performance.now() - t0) / 1000) * 10) / 10;
    const addEvent = (ev) => {
      if (events.length < EVENTS_MAX) events.push(ev);
    };

    const plan = PING_PLAN.filter((s) => s <= DUR - 15);
    if (loginOk) {
      say('保持实时连接，请不要锁屏、不要切后台。');
      const pend = new Map();
      const subAt = performance.now();
      t0 = subAt;
      pb.realtime.onDisconnect = () => {
        if (closing) return;
        dropAt = performance.now();
        drops += 1;
        addEvent({ k: 'drop', t: sec() });
      };
      try {
        await pb.realtime.subscribe('PB_CONNECT', () => {
          const now = performance.now();
          if (firstConnectAt === null) {
            firstConnectAt = now;
            m.rt_connect_ms = now - subAt;
            return;
          }
          if (dropAt !== null) {
            const ms = Math.round(now - dropAt);
            addEvent({ k: 'reconnect', t: sec(), ms });
            if (ms > maxReconnect) maxReconnect = ms;
            dropAt = null;
          }
        });
        await pb.collection('probe_pings').subscribe(
          '*',
          (e) => {
            if (!e || e.action !== 'create' || !e.record) return;
            const p = pend.get(e.record.seq);
            if (p && p.recv === undefined) {
              p.recv = performance.now();
              p.done();
            }
          },
          { filter: pb.filter('run = {:r}', { r: RUN_ID }) },
        );
      } catch (e) {
        // 实时一直连不上也是要记录的结果：继续按计划打点，收不到的记为丢失
      }

      const tick = setInterval(() => {
        elLeft.textContent = '剩余约 ' + Math.max(0, Math.round(DUR - (performance.now() - t0) / 1000)) + ' 秒';
      }, 1000);
      const sleepUntil = (s) => sleep(Math.max(0, t0 + s * 1000 - performance.now()));

      for (let seq = 0; seq < plan.length; seq += 1) {
        await sleepUntil(plan[seq]);
        const p = { sent: performance.now(), recv: undefined, done: null };
        pend.set(seq, p);
        const got = new Promise((res) => {
          p.done = res;
          setTimeout(res, PING_WAIT_MS);
        });
        const vals = { run: RUN_ID, seq };
        const rec = {};
        PING_FIELDS.forEach((k) => {
          rec[k] = vals[k];
        });
        try {
          await pb.collection('probe_pings').create(rec);
        } catch (e) {
          p.done();
        }
        await got;
        if (p.recv !== undefined) {
          pushMs.push(Math.round(p.recv - p.sent));
          pingsOk += 1;
        } else {
          pushMs.push(null);
        }
      }
      await sleepUntil(DUR);
      clearInterval(tick);
      elLeft.textContent = '';
      m.dur_s = (performance.now() - t0) / 1000;

      closing = true;
      try {
        await pb.realtime.unsubscribe();
      } catch (e) {}
    } else {
      m.dur_s = 0;
    }

    if (hiddenSince !== null) hiddenMs += performance.now() - hiddenSince;
    m.hidden_ms = hiddenMs;
    m.drops = drops;
    m.max_reconnect_ms = maxReconnect;
    m.pings_ok = pingsOk;
    m.pings_total = plan.length;
    m.push_ms = pushMs;
    m.events = events;

    // 只按 RESULT_FIELDS 取键组装上传记录，没测到的键省略
    const record = {};
    RESULT_FIELDS.forEach((k) => {
      let v = m[k];
      if (typeof v === 'number') v = num(v);
      if (v !== undefined && v !== null) record[k] = v;
    });

    say('上传结果……');
    let uploaded = false;
    for (let i = 0; i <= UPLOAD_RETRIES && !uploaded; i += 1) {
      if (i > 0) await sleep(UPLOAD_GAP_MS);
      try {
        await pb.collection('probe_results').create(record);
        uploaded = true;
      } catch (e) {}
    }
    pb.authStore.clear();

    const lines = [
      '编号 ' + RUN_ID.slice(0, 4),
      '运营商 ' + (CARRIER_NAME[carrier] || carrier) + ' / 网络 ' + (NET_NAME[net] || net),
      '首屏 ' + (record.first_screen_ms !== undefined ? record.first_screen_ms + ' ms' : '未测到'),
      '登录 ' + (loginOk ? '成功 ' + record.login_ms + ' ms' : '失败'),
      '接口往返 ' + (record.api_rtt_ms !== undefined ? record.api_rtt_ms + ' ms' : '未测到'),
      '掉线 ' + drops + ' 次，最大重连 ' + maxReconnect + ' ms',
      '打点收到 ' + pingsOk + '/' + plan.length + '，推送中位 ' + (median(pushMs) !== null ? median(pushMs) + ' ms' : '无'),
      uploaded ? '已上传' : '上传失败',
    ];
    elSummary.textContent = lines.join('\n');
    elSummary.hidden = false;
    elShot.hidden = uploaded;
    say(uploaded ? '测试完成，结果已上传。可以截图这一屏留底（不要带地址栏）。' : '测试完成，但上传失败。');
    running = false;
    radios.forEach((r) => {
      r.disabled = false;
    });
    sync();
  };

  elStart.addEventListener('click', () => {
    if (elStart.disabled) return;
    run().catch((e) => {
      say('出错：' + (e && e.message ? e.message : '未知错误'));
      elShot.hidden = false;
      running = false;
      radios.forEach((r) => {
        r.disabled = false;
      });
      sync();
    });
  });
})();

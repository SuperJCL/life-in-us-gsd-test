// 零依赖的最小 SSE 客户端（Phase 8，08-05；隔离脚本的实时断言用）。只使用 Node 自带的 fetch。
//
// openSse(baseUrl, { timeoutMs })：连 GET /api/realtime，按空行切块，解析 id:、event:、data: 三种行；
//   PB_CONNECT 事件的 id 就是 clientId。返回 { clientId, events, errors, close }：
//   events 是 { id, event, data } 数组（data 是原始文本，调用方自己解析，也不要打印）；
//   errors 记录流读取中的异常名（主动关闭不算）；close() 中止连接并等读取循环结束。
//   超时拿不到 PB_CONNECT 就关闭连接并抛错。
// subscribe(baseUrl, clientId, subscriptions, token?)：POST /api/realtime，返回状态码（成功 204）。
//   身份由这次提交带的令牌决定，之后事件按这个身份过集合规则。
//
// 隐私约定：本文件不打印任何内容。

export async function openSse(baseUrl, { timeoutMs = 10000 } = {}) {
  const ac = new AbortController();
  const events = [];
  const errors = [];
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, timeoutMs);

  let res;
  try {
    res = await fetch(`${baseUrl}/api/realtime`, { headers: { accept: 'text/event-stream' }, signal: ac.signal });
  } catch (e) {
    clearTimeout(timer);
    throw new Error(timedOut ? 'SSE 连接超时' : 'SSE 连接失败');
  }
  if (res.status !== 200 || !res.body) {
    clearTimeout(timer);
    ac.abort();
    throw new Error(`SSE 连接被拒（${res.status}）`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let onConnect;
  const connected = new Promise((resolve) => {
    onConnect = resolve;
  });

  const parseBlock = (block) => {
    const ev = { id: '', event: 'message', data: '' };
    const dataLines = [];
    for (const line of block.split(/\r?\n/)) {
      if (line === '' || line.startsWith(':')) continue;
      const i = line.indexOf(':');
      const field = i === -1 ? line : line.slice(0, i);
      const value = i === -1 ? '' : line.slice(i + 1).replace(/^ /, '');
      if (field === 'id') ev.id = value;
      else if (field === 'event') ev.event = value;
      else if (field === 'data') dataLines.push(value);
    }
    ev.data = dataLines.join('\n');
    return ev;
  };

  const pump = (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let m;
        while ((m = /\r?\n\r?\n/.exec(buf))) {
          const block = buf.slice(0, m.index);
          buf = buf.slice(m.index + m[0].length);
          if (block.trim() === '') continue;
          const ev = parseBlock(block);
          events.push(ev);
          if (ev.event === 'PB_CONNECT') onConnect(ev.id);
        }
      }
    } catch (e) {
      if (!ac.signal.aborted) errors.push((e && e.name) || 'error');
    }
  })();

  const close = async () => {
    clearTimeout(timer);
    ac.abort();
    await pump;
  };

  const clientId = await Promise.race([
    connected,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
  clearTimeout(timer);
  if (!clientId) {
    await close();
    throw new Error('SSE 超时，没有收到 PB_CONNECT');
  }
  return { clientId, events, errors, close };
}

export async function subscribe(baseUrl, clientId, subscriptions, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = token;
  const res = await fetch(`${baseUrl}/api/realtime`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clientId, subscriptions }),
    signal: AbortSignal.timeout(15000),
  });
  await res.arrayBuffer();
  return res.status;
}

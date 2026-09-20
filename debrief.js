/* Extends the existing ledger; no framework and no browser-stored API keys. */
let debriefState = null;
let debriefAccess = '';
let debriefPhase = 'idle';
let debriefMessage = '';
let debriefAudio = null;
const debriefBusy = () => debriefPhase !== 'idle';
const freshDebrief = () => ({ id: uid('debrief'), title: '', transcript: '', sourceText: '', questions: [], draft: null, reviewedTranscript: '', saved: false });

function sessionData() {
  if (!debriefState) debriefState = meta.voiceDebrief || freshDebrief();
  return debriefState;
}
function persistDebrief() {
  setMeta('voiceDebrief', sessionData()).catch(() => {
    debriefMessage = 'Could not save this draft locally. Copy the transcript before closing.';
    updateDebriefStatus();
  });
}
function updateDebriefStatus() {
  if (!$('debriefStatus')) return;
  $('debriefStatus').textContent = debriefMessage || 'Draft kept in this browser.';
  const busy = debriefBusy();
  $('voiceRecord').textContent = debriefPhase === 'recording' ? 'Stop & review' : debriefPhase === 'connecting' ? 'Connecting…' : 'Record session';
  $('voiceRecord').disabled = busy && debriefPhase !== 'recording';
  $('voiceReview').disabled = busy || !sessionData().transcript.trim();
  $('voiceSave').disabled = busy || !sessionData().draft || sessionData().saved;
  $('voiceNew').disabled = busy;
  for (const id of ['voiceTranscript', 'voiceTitle', 'voiceSources', 'voiceEndpoint', 'voicePassword']) $(id).disabled = busy;
  document.querySelectorAll('.tab').forEach(b => { b.disabled = busy; });
  for (const id of ['resetButton', 'importButton']) $(id).disabled = busy;
}
function renderDebrief() {
  const s = sessionData();
  return `<section class="debrief-layout">
    <div class="debrief-capture">
      <div class="debrief-topline"><span class="badge accent">AssemblyAI</span><button id="voiceNew" class="quiet-button" type="button">New session</button></div>
      <label for="voiceTitle">Topic or task</label>
      <input id="voiceTitle" maxlength="200" value="${esc(s.title)}" placeholder="Name the subject, problem, lab, or task" />
      <label for="voiceTranscript">Your study session</label>
      <textarea id="voiceTranscript" maxlength="24000" placeholder="What are you studying or practicing? Explain what you understood, tried, observed, and still find unclear.">${esc(s.transcript)}</textarea>
      <div class="debrief-actions"><button id="voiceRecord" type="button" class="primary-button">Record session</button><button id="voiceReview" type="button" class="secondary-button">Review text</button></div>
      <p class="debrief-privacy">Recording sends audio to AssemblyAI. Review sends this transcript and your source URLs to its LLM Gateway. Saved records stay in this browser.</p>
      <label for="voiceSources">Sources <span class="muted">— one URL per line</span></label>
      <textarea id="voiceSources" rows="2" placeholder="https://…">${esc(s.sourceText)}</textarea>
      <details class="debrief-connection"><summary>Connection</summary>
        <label for="voiceEndpoint">Voice service URL</label><input id="voiceEndpoint" type="url" placeholder="Leave blank when hosted together" value="${esc(meta.voiceEndpoint || '')}" />
        <label for="voicePassword">Service access password</label><input id="voicePassword" type="password" autocomplete="off" value="${esc(debriefAccess)}" placeholder="Kept only until this page closes" />
        <p class="debrief-privacy">Use the service password, not your AssemblyAI API key.</p>
        <button id="voiceConnect" class="secondary-button" type="button">Check connection</button>
      </details>
      <label class="debrief-speak"><input id="voiceSpeak" type="checkbox" ${meta.voiceSpeak === false ? '' : 'checked'} /> Read follow-up questions aloud</label>
      <p id="debriefStatus" class="debrief-status" role="status" aria-live="polite"></p>
    </div>
    <div class="debrief-result">
      <div class="debrief-result-head"><div><p class="eyebrow">Review before saving</p><h2>Study notes</h2></div><button id="voiceSave" class="secondary-button" type="button">${s.saved ? 'Saved' : 'Save to ledger'}</button></div>
      <div id="debriefDraft">${renderDebriefDraft()}</div>
    </div>
  </section>`;
}
function renderDebriefDraft() {
  const s = sessionData(), d = s.draft;
  if (!d) return '<div class="debrief-empty"><span aria-hidden="true">01 / CAPTURE</span><h3>Keep the reasoning.</h3><p>Narrate or paste what you are studying. The debrief asks focused follow-ups and keeps the original evidence alongside your notes.</p></div>';
  const group = (label, items) => items.length ? `<section class="debrief-section"><h3>${label}</h3>${items.map(item => `<p>${esc(item.text)}</p><blockquote>${esc(item.evidence)}</blockquote>`).join('')}</section>` : '';
  return `${d.question ? `<section class="debrief-question"><span class="eyebrow">Follow-up ${s.questions.length} / 3</span><p>${esc(d.question)}</p><span>Append your answer to the session, or record it.</span></section>` : ''}
    <section class="debrief-section"><h3>Agent summary — review required</h3><p>${esc(d.summary)}</p></section>
    ${group('Steps from your session', d.steps)}${group('Failed attempts', d.failedAttempts)}${group('Lessons you identified', d.lessons)}
    ${d.gaps.length ? `<section class="debrief-section"><h3>Still missing</h3><ul>${d.gaps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
    ${d.suggestions.length ? `<section class="debrief-section"><h3>Agent suggestions — unverified</h3><ul>${d.suggestions.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
    <p class="debrief-privacy">Quotes are checked against your transcript. You still need to verify the interpretation. Sources are preserved as references; their pages are not fetched.</p>`;
}
function refreshDebriefDraft() { if ($('debriefDraft')) $('debriefDraft').innerHTML = renderDebriefDraft(); updateDebriefStatus(); }
function invalidateDebrief() { const s = sessionData(); s.draft = null; s.saved = false; persistDebrief(); refreshDebriefDraft(); }
function parseDebriefSources(value) {
  return [...new Set(value.split('\n').map(x => x.trim()).filter(Boolean))].map(value => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use HTTP or HTTPS source URLs without credentials.');
    return url.href;
  });
}
async function debriefApi(path, body) {
  const endpoint = (meta.voiceEndpoint || '').trim().replace(/\/$/, '');
  if (endpoint) {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) throw new Error('Use an HTTPS voice service, or localhost for development.');
    if (u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('Enter only the service origin, for example https://your-service.onrender.com.');
  }
  const response = await fetch(endpoint + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Ledger-Token': debriefAccess }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(55000), credentials: 'omit' });
  let result;
  try { result = await response.json(); } catch { throw new Error('No voice service here yet. Open Connection and set your service URL.'); }
  if (!response.ok) throw new Error(result.error || 'Voice service request failed.');
  return result;
}
function bindDebrief() {
  for (const [id, key] of [['voiceTitle', 'title'], ['voiceTranscript', 'transcript'], ['voiceSources', 'sourceText']]) $(id).addEventListener('input', event => { sessionData()[key] = event.target.value; invalidateDebrief(); });
  $('voiceEndpoint').addEventListener('change', event => { setMeta('voiceEndpoint', event.target.value.trim()).catch(error => { debriefMessage = error.message; updateDebriefStatus(); }); });
  $('voicePassword').addEventListener('input', event => { debriefAccess = event.target.value; });
  $('voiceSpeak').addEventListener('change', event => { setMeta('voiceSpeak', event.target.checked).catch(() => {}); if (!event.target.checked) window.speechSynthesis?.cancel(); });
  $('voiceConnect').onclick = async () => {
    try { const h = await debriefApi('/api/health'); debriefMessage = h.configured ? 'Service is configured. Record or review text to begin.' : 'Service found; its AssemblyAI key and access password still need configuration.'; }
    catch (error) { debriefMessage = error.message; } updateDebriefStatus();
  };
  $('voiceRecord').onclick = () => debriefPhase === 'recording' ? stopDebriefRecording() : startDebriefRecording();
  $('voiceReview').onclick = reviewDebrief;
  $('voiceSave').onclick = saveDebrief;
  $('voiceNew').onclick = async () => {
    if (sessionData().transcript && !sessionData().saved && !confirm('Discard this unsaved debrief and start a new one?')) return;
    window.speechSynthesis?.cancel(); debriefState = freshDebrief(); debriefMessage = ''; persistDebrief(); render();
  };
  updateDebriefStatus();
}
async function reviewDebrief() {
  if (debriefBusy()) return;
  const s = sessionData();
  if (!s.transcript.trim()) return;
  debriefPhase = 'reviewing'; debriefMessage = 'Reviewing your study session…'; updateDebriefStatus();
  try {
    const { draft } = await debriefApi('/api/debrief', { transcript: s.transcript, title: s.title, sources: parseDebriefSources(s.sourceText), questions: s.questions });
    s.draft = draft; s.reviewedTranscript = s.transcript; s.saved = false;
    if (draft.question && !s.questions.includes(draft.question)) s.questions.push(draft.question);
    persistDebrief();
    debriefMessage = draft.question ? 'Answer the follow-up, or save the partial draft.' : 'Review the draft, then save it to your ledger.';
    if (draft.question && meta.voiceSpeak !== false && window.speechSynthesis) {
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(draft.question));
    }
  } catch (error) { debriefMessage = error.message; }
  finally { debriefPhase = 'idle'; refreshDebriefDraft(); }
}
async function releaseDebriefAudio() {
  const a = debriefAudio; if (!a) return;
  clearTimeout(a.timeout); clearTimeout(a.limit); a.worklet?.disconnect(); a.source?.disconnect(); a.gain?.disconnect();
  a.stream?.getTracks().forEach(t => t.stop());
  if (a.context && a.context.state !== 'closed') await a.context.close().catch(() => {});
}
async function startDebriefRecording() {
  if (debriefBusy()) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) { debriefMessage = 'Live narration needs a browser with microphone and AudioWorklet support over HTTPS. You can paste your study session below.'; updateDebriefStatus(); return; }
  debriefPhase = 'connecting'; debriefMessage = 'Allow microphone access to start narration.'; updateDebriefStatus();
  window.speechSynthesis?.cancel();
  const a = { turns: new Map(), prefix: sessionData().transcript.trim(), stopping: false, intentional: false };
  debriefAudio = a;
  try {
    a.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    a.context = new AudioContext({ sampleRate: 16000 });
    if (a.context.sampleRate !== 16000) throw new Error('This device cannot capture at 16 kHz. Use the editable transcript instead.');
    await a.context.resume();
    await a.context.audioWorklet.addModule('./pcm-worklet.js');
    const { token } = await debriefApi('/api/voice/token', {});
    a.socket = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&token=${encodeURIComponent(token)}`);
    await new Promise((resolve, reject) => {
      a.timeout = setTimeout(() => reject(new Error('AssemblyAI connection timed out. Try again.')), 15000);
      a.socket.onopen = () => { clearTimeout(a.timeout); resolve(); };
      a.socket.onerror = () => reject(new Error('Could not connect to AssemblyAI streaming.'));
    });
    a.socket.onmessage = event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'Turn' && typeof message.transcript === 'string') {
        a.turns.set(message.turn_order, message.transcript);
        const text = [a.prefix, ...[...a.turns].sort((x, y) => x[0] - y[0]).map(x => x[1])].filter(Boolean).join('\n');
        sessionData().transcript = text.slice(0, 24000); sessionData().draft = null; sessionData().saved = false;
        if ($('voiceTranscript')) $('voiceTranscript').value = sessionData().transcript;
        persistDebrief();
        if (text.length >= 24000 && !a.stopping) stopDebriefRecording();
      }
      if (message.type === 'Termination') a.finish?.();
      if (message.type === 'Error' || message.error) { debriefMessage = 'AssemblyAI ended narration with an error. Your partial transcript is available.'; a.socket.close(); }
    };
    a.socket.onclose = async () => {
      a.finish?.();
      if (!a.intentional && debriefAudio === a) {
        await releaseDebriefAudio(); debriefAudio = null; debriefPhase = 'idle';
        debriefMessage = 'Narration disconnected. Your partial transcript is kept; review it or reconnect.'; refreshDebriefDraft();
      }
    };
    a.socket.onerror = () => { debriefMessage = 'Streaming connection failed. Your transcript is kept.'; updateDebriefStatus(); };
    a.source = a.context.createMediaStreamSource(a.stream);
    a.worklet = new AudioWorkletNode(a.context, 'ledger-pcm');
    a.gain = a.context.createGain(); a.gain.gain.value = 0;
    a.worklet.port.onmessage = event => {
      if (event.data?.flushed) { a.flushed?.(); return; }
      if (a.socket.readyState === WebSocket.OPEN) a.socket.send(event.data);
    };
    a.source.connect(a.worklet); a.worklet.connect(a.gain); a.gain.connect(a.context.destination);
    a.limit = setTimeout(stopDebriefRecording, 9 * 60 * 1000);
    debriefPhase = 'recording'; debriefMessage = 'Listening through AssemblyAI. Stop when you are ready for follow-up questions.'; updateDebriefStatus();
  } catch (error) {
    a.intentional = true; a.socket?.close(); await releaseDebriefAudio(); debriefAudio = null;
    debriefPhase = 'idle'; debriefMessage = error.name === 'NotAllowedError' ? 'Microphone permission was denied. You can still type your study session.' : error.message; updateDebriefStatus();
  }
}
async function stopDebriefRecording() {
  const a = debriefAudio; if (!a || a.stopping) return;
  a.stopping = true; a.intentional = true; debriefPhase = 'finishing'; debriefMessage = 'Finishing the transcript…'; updateDebriefStatus();
  a.source?.disconnect();
  if (a.worklet) await new Promise(resolve => {
    const timer = setTimeout(resolve, 300); a.flushed = () => { clearTimeout(timer); resolve(); };
    a.worklet.port.postMessage('flush');
  });
  await releaseDebriefAudio();
  if (a.socket?.readyState === WebSocket.OPEN) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 2200); a.finish = () => { clearTimeout(timer); resolve(); };
      a.socket.send(JSON.stringify({ type: 'Terminate' }));
    });
  }
  a.socket?.close(); debriefAudio = null; debriefPhase = 'idle'; persistDebrief();
  if (sessionData().transcript.trim()) await reviewDebrief();
  else { debriefMessage = 'No speech was transcribed. Try again or type your study session.'; updateDebriefStatus(); }
}
async function saveDebrief() {
  const s = sessionData(); if (debriefBusy() || !s.draft || s.saved) return;
  debriefPhase = 'saving'; updateDebriefStatus();
  try {
    const d = s.draft, title = s.title.trim() || 'Untitled debrief', sourceIds = [], batch = [];
    const timestamp = nowIso();
    for (const url of parseDebriefSources(s.sourceText)) {
      const existing = recordsOf('source').find(r => r.url === url);
      const source = existing || commonRecord({ title: new URL(url).hostname, url, notes: 'Reference supplied by the learner; page not fetched by the debrief agent.', accessedAt: timestamp }, 'source');
      sourceIds.push(source.id); if (!existing) batch.push(source);
    }
    const captureId = `${s.id}-capture`, noteId = `${s.id}-note`, sessionId = `${s.id}-session`;
    const lines = items => items.map(x => `${x.text}\nEvidence: “${x.evidence}”`);
    batch.push(commonRecord({ id: captureId, title, rawText: s.transcript, status: 'processed', generatedRecordIds: [noteId, sessionId, ...sourceIds], sourceIds, attachments: [], provider: 'AssemblyAI debrief', questions: s.questions }, 'capture'));
    batch.push(commonRecord({ id: noteId, title, summary: d.summary, content: [...lines(d.lessons), ...lines(d.steps)].join('\n\n'), sourceIds, relatedIds: [captureId, sessionId], reviewStatus: 'User-reviewed AI draft', provenance: { captureId, provider: 'AssemblyAI LLM Gateway' } }, 'note'));
    batch.push(commonRecord({ id: sessionId, title: `${title} — session`, activityType: 'study-session', overview: d.summary, steps: lines(d.steps), failedAttempts: lines(d.failedAttempts), lessons: lines(d.lessons), sourceIds, relatedIds: [captureId, noteId], originalTranscript: s.transcript, openQuestions: [...d.gaps, ...(d.question ? [d.question] : [])], agentSuggestions: d.suggestions, reviewStatus: 'User-reviewed AI draft; completion not asserted', completedAt: '', provenance: { captureId, provider: 'AssemblyAI LLM Gateway' } }, 'session'));
    const saved = { ...s, saved: true };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['records', 'meta'], 'readwrite');
      for (const record of batch) tx.objectStore('records').put(record);
      tx.objectStore('meta').put({ key: 'voiceDebrief', value: saved });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    debriefState = saved; await loadModel(); debriefMessage = 'Saved: original capture, study note, study-session record, and linked sources.';
  } catch (error) { debriefMessage = `Could not save: ${error.message}. Your draft is still available.`; }
  finally { debriefPhase = 'idle'; render(); }
}
window.addEventListener('beforeunload', () => {
  window.speechSynthesis?.cancel(); debriefAudio?.stream?.getTracks().forEach(t => t.stop());
  if (debriefAudio?.socket?.readyState === WebSocket.OPEN) debriefAudio.socket.send(JSON.stringify({ type: 'Terminate' }));
});

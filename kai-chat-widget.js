(function (global) {
  'use strict';

  var VERSION = '1.0.0';
  var instances = [];
  var DEFAULTS = {
    accentColor: '#6d5dfc',
    backgroundColor: '#ffffff',
    textColor: '#172033',
    position: 'right',
    title: 'Chat with us',
    welcomeMessage: 'Hi! How can I help you today?',
    placeholder: 'Type a message…',
    launcherLabel: 'Open chat',
    requirePhone: true,
    persistConversation: true,
    zIndex: 2147483000,
    requestTimeoutMs: 45000
  };

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  function normalizeConfig(input) {
    var config = Object.assign({}, DEFAULTS, input || {});
    var required = ['endpoint'];
    required.forEach(function (key) {
      if (!config[key] || typeof config[key] !== 'string') throw new Error('KaiChat: ' + key + ' is required');
    });
    if (!config.widgetToken) {
      if (!config.publicToken || !config.organizationId) throw new Error('KaiChat: widgetToken or legacy publicToken and organizationId are required');
      if (!config.agentId && !config.agentName) throw new Error('KaiChat: agentId or agentName is required');
    }
    if (!/^#[0-9a-f]{6}$/i.test(config.accentColor)) throw new Error('KaiChat: accentColor must be a six-digit hex color');
    config.position = config.position === 'left' ? 'left' : 'right';
    config.endpoint = config.endpoint.replace(/\/$/, '');
    return config;
  }

  function createElement(document, tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function createWidget(rawConfig) {
    var config = normalizeConfig(rawConfig);
    var document = global.document;
    var host = document.createElement('div');
    host.setAttribute('data-kai-chat-widget', VERSION);
    document.body.appendChild(host);
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var storageKey = 'kai-chat:' + (config.widgetToken ? config.widgetToken.split('.')[0] : config.organizationId + ':' + (config.agentId || config.agentName));
    var conversationId = config.persistConversation && global.sessionStorage
      ? global.sessionStorage.getItem(storageKey)
      : null;
    var visitor = Object.assign({}, config.visitor || {});
    var open = false;
    var sending = false;

    var style = document.createElement('style');
    style.textContent = [
      ':host{--kai-accent:' + config.accentColor + ';--kai-bg:' + config.backgroundColor + ';--kai-text:' + config.textColor + ';all:initial}',
      '*{box-sizing:border-box}.kai-wrap{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--kai-text)}',
      '.kai-launcher{position:fixed;bottom:24px;' + config.position + ':24px;width:58px;height:58px;border:0;border-radius:50%;background:var(--kai-accent);color:#fff;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.22);font-size:25px;z-index:' + config.zIndex + '}',
      '.kai-panel{position:fixed;bottom:94px;' + config.position + ':24px;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 120px));display:none;grid-template-rows:auto 1fr auto;background:var(--kai-bg);border:1px solid rgba(0,0,0,.09);border-radius:18px;overflow:hidden;box-shadow:0 22px 65px rgba(0,0,0,.24);z-index:' + config.zIndex + '}',
      '.kai-panel.open{display:grid}.kai-header{display:flex;align-items:center;gap:10px;padding:15px 16px;background:var(--kai-accent);color:#fff}.kai-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,.22)}.kai-heading{min-width:0;flex:1}.kai-title{font-weight:700;font-size:15px}.kai-status{font-size:12px;opacity:.85}.kai-close{border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer}',
      '.kai-messages{padding:16px;overflow:auto;background:color-mix(in srgb,var(--kai-bg) 96%,#888);display:flex;flex-direction:column;gap:10px}.kai-message{max-width:84%;padding:10px 12px;border-radius:14px;line-height:1.4;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}.kai-agent{align-self:flex-start;background:#eef0f5}.kai-user{align-self:flex-end;background:var(--kai-accent);color:#fff}.kai-error{align-self:center;color:#a32020;background:#feecec;font-size:12px}',
      '.kai-form{padding:12px;border-top:1px solid rgba(0,0,0,.08);display:flex;gap:8px;background:var(--kai-bg)}.kai-input{min-width:0;flex:1;border:1px solid #cfd4df;border-radius:12px;padding:11px 12px;font:inherit;color:var(--kai-text);background:var(--kai-bg)}.kai-send{border:0;border-radius:12px;padding:0 16px;background:var(--kai-accent);color:#fff;font-weight:700;cursor:pointer}.kai-send:disabled{opacity:.55;cursor:wait}',
      '.kai-profile{padding:20px;display:none;flex-direction:column;gap:10px;overflow:auto}.kai-profile.visible{display:flex}.kai-profile label{font:600 12px inherit}.kai-profile input{border:1px solid #cfd4df;border-radius:10px;padding:10px;font:14px inherit}.kai-profile button{border:0;border-radius:10px;padding:11px;background:var(--kai-accent);color:#fff;font-weight:700;cursor:pointer}',
      '@media(max-width:480px){.kai-panel{left:8px;right:8px;bottom:82px;width:auto;height:calc(100vh - 98px);border-radius:16px}.kai-launcher{bottom:16px;' + config.position + ':16px}}'
    ].join('');
    root.appendChild(style);

    var wrap = createElement(document, 'div', 'kai-wrap');
    var launcher = createElement(document, 'button', 'kai-launcher', '✦');
    launcher.type = 'button';
    launcher.setAttribute('aria-label', config.launcherLabel);
    var panel = createElement(document, 'section', 'kai-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', config.title);
    var header = createElement(document, 'header', 'kai-header');
    if (config.avatarUrl) {
      var avatar = createElement(document, 'img', 'kai-avatar');
      avatar.src = config.avatarUrl;
      avatar.alt = '';
      header.appendChild(avatar);
    }
    var heading = createElement(document, 'div', 'kai-heading');
    heading.innerHTML = '<div class="kai-title">' + escapeHtml(config.title) + '</div><div class="kai-status">Online</div>';
    var closeButton = createElement(document, 'button', 'kai-close', '×');
    closeButton.type = 'button'; closeButton.setAttribute('aria-label', 'Close chat');
    header.appendChild(heading); header.appendChild(closeButton);
    var messages = createElement(document, 'div', 'kai-messages');
    messages.setAttribute('aria-live', 'polite');
    var profileForm = createElement(document, 'form', 'kai-profile');
    profileForm.innerHTML = '<label>Phone number *</label><input name="phone" type="tel" autocomplete="tel" required maxlength="20"><label>Email</label><input name="email" type="email" autocomplete="email" maxlength="320"><label>First name</label><input name="firstName" autocomplete="given-name" maxlength="100"><button type="submit">Start chat</button>';
    var messageForm = createElement(document, 'form', 'kai-form');
    var input = createElement(document, 'input', 'kai-input');
    input.name = 'message'; input.maxLength = 8000; input.placeholder = config.placeholder; input.autocomplete = 'off';
    var send = createElement(document, 'button', 'kai-send', 'Send');
    send.type = 'submit';
    messageForm.appendChild(input); messageForm.appendChild(send);
    panel.appendChild(header); panel.appendChild(messages); panel.appendChild(profileForm); panel.appendChild(messageForm);
    wrap.appendChild(panel); wrap.appendChild(launcher); root.appendChild(wrap);

    function addMessage(text, role) {
      var item = createElement(document, 'div', 'kai-message kai-' + role, text);
      messages.appendChild(item); messages.scrollTop = messages.scrollHeight;
      return item;
    }
    addMessage(config.welcomeMessage, 'agent');

    function setOpen(next) {
      open = next;
      panel.classList.toggle('open', open);
      launcher.setAttribute('aria-expanded', String(open));
      if (open) input.focus();
      if (typeof config.onOpen === 'function' && open) config.onOpen();
      if (typeof config.onClose === 'function' && !open) config.onClose();
    }
    function syncProfile() {
      var needsProfile = config.requirePhone && !visitor.phoneNumber;
      profileForm.classList.toggle('visible', needsProfile);
      messages.style.display = needsProfile ? 'none' : 'flex';
      messageForm.style.display = needsProfile ? 'none' : 'flex';
    }
    syncProfile();
    launcher.addEventListener('click', function () { setOpen(!open); });
    closeButton.addEventListener('click', function () { setOpen(false); });
    profileForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new global.FormData(profileForm);
      visitor.phoneNumber = String(data.get('phone') || '').trim();
      visitor.email = String(data.get('email') || '').trim();
      visitor.firstName = String(data.get('firstName') || '').trim();
      syncProfile(); input.focus();
    });
    messageForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      var message = input.value.trim();
      if (!message || sending) return;
      sending = true; send.disabled = true; input.value = ''; addMessage(message, 'user');
      var controller = new global.AbortController();
      var timer = global.setTimeout(function () { controller.abort(); }, config.requestTimeoutMs);
      try {
        var response = await global.fetch(config.endpoint, {
          method: 'POST', signal: controller.signal,
          headers: Object.assign({ 'Content-Type': 'application/json' }, config.widgetToken
            ? { 'X-Widget-Token': config.widgetToken }
            : { 'X-Client-Token': config.publicToken }),
          body: JSON.stringify(Object.assign({}, visitor, {
            organizationId: config.organizationId,
            agentId: config.agentId || undefined,
            agentName: config.agentName || undefined,
            conversationId: conversationId || undefined,
            requestId: uuid(), message: message
          }))
        });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.success) throw new Error(result.error || 'Message could not be sent');
        conversationId = result.conversationId || conversationId;
        if (conversationId && config.persistConversation && global.sessionStorage) global.sessionStorage.setItem(storageKey, conversationId);
        addMessage(result.response || '', 'agent');
        if (typeof config.onMessage === 'function') config.onMessage(result);
      } catch (error) {
        addMessage(error.name === 'AbortError' ? 'The request timed out. Please try again.' : error.message, 'error');
        input.value = message;
        if (typeof config.onError === 'function') config.onError(error);
      } finally {
        global.clearTimeout(timer); sending = false; send.disabled = false; input.focus();
      }
    });

    var api = {
      open: function () { setOpen(true); }, close: function () { setOpen(false); },
      toggle: function () { setOpen(!open); },
      setVisitor: function (nextVisitor) { visitor = Object.assign({}, visitor, nextVisitor || {}); syncProfile(); },
      reset: function () { conversationId = null; if (global.sessionStorage) global.sessionStorage.removeItem(storageKey); messages.innerHTML = ''; addMessage(config.welcomeMessage, 'agent'); },
      destroy: function () { host.remove(); instances = instances.filter(function (item) { return item !== api; }); },
      version: VERSION
    };
    instances.push(api);
    return api;
  }

  var KaiChat = {
    version: VERSION,
    init: createWidget,
    getInstances: function () { return instances.slice(); },
    destroyAll: function () { instances.slice().forEach(function (instance) { instance.destroy(); }); }
  };
  global.KaiChat = KaiChat;

  var script = global.document && global.document.currentScript;
  if (script && script.dataset && script.dataset.autoInit !== 'false' && script.dataset.endpoint) {
    var embedded = global.__KAI_CHAT_CONFIG__ || {};
    var dataConfig = {
      endpoint: script.dataset.endpoint,
      widgetToken: script.dataset.widgetToken,
      publicToken: script.dataset.publicToken,
      organizationId: script.dataset.organizationId,
      agentId: script.dataset.agentId,
      agentName: script.dataset.agentName,
      title: script.dataset.title,
      accentColor: script.dataset.accentColor,
      position: script.dataset.position
    };
    Object.keys(dataConfig).forEach(function (key) { if (dataConfig[key] == null || dataConfig[key] === '') delete dataConfig[key]; });
    global.setTimeout(function () { createWidget(Object.assign({}, embedded, dataConfig)); }, 0);
  } else if (global.__KAI_CHAT_CONFIG__) {
    global.setTimeout(function () { createWidget(global.__KAI_CHAT_CONFIG__); }, 0);
  }
})(window);

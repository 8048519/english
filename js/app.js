/* ========================================
   初中英语单词背诵助手 - 主逻辑
   ======================================== */

(function () {
  'use strict';

  // ========== 常量定义 ==========
  const STORAGE_KEY_WORDS = 'vocab_words';          // 自定义题库
  const STORAGE_KEY_DAILY = 'vocab_daily_words';    // 每日抽词记录
  const DAILY_COUNT = 50;                            // 每日抽取数量

  // ========== 全局状态 ==========
  let wordBank = [];        // 完整题库
  let todayWords = [];      // 今日单词
  let todayDateStr = '';    // 今日日期字符串
  let showMeaning = true;   // 是否显示释义（主页）
  let printShowMeaning = false; // 打印页是否显示释义
  let searchKeyword = '';   // 搜索关键词
  let editingId = null;     // 当前编辑的单词 ID

  // ========== 工具函数 ==========

  /** 获取今日日期字符串，格式 YYYY-MM-DD */
  function getTodayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** 获取易读的日期格式 */
  function formatDateReadable(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日`;
  }

  /** Fisher-Yates 洗牌算法 */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** 从 localStorage 读取 JSON */
  function loadStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('读取本地存储失败:', key, e);
      return fallback;
    }
  }

  /** 写入 localStorage */
  function saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('写入本地存储失败:', key, e);
      showToast('保存失败：本地存储空间不足', 'error');
      return false;
    }
  }

  /** 生成新的单词 ID */
  function nextId() {
    if (wordBank.length === 0) return 1;
    return Math.max(...wordBank.map(w => w.id)) + 1;
  }

  /** Toast 提示 */
  let toastTimer = null;
  function showToast(msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.className = 'toast';
    }, 2200);
  }

  // ========== 数据加载 ==========

  /** 加载内置题库（从 JSON 文件） */
  async function loadBuiltinWords() {
    try {
      const resp = await fetch('data/words.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('加载内置题库失败:', err);
      return [];
    }
  }

  /** 初始化题库：优先从 localStorage 读取，否则使用内置题库 */
  async function initWordBank() {
    const custom = loadStorage(STORAGE_KEY_WORDS, null);
    if (custom && Array.isArray(custom) && custom.length > 0) {
      wordBank = custom;
    } else {
      wordBank = await loadBuiltinWords();
      if (wordBank.length > 0) {
        saveStorage(STORAGE_KEY_WORDS, wordBank);
      }
    }
  }

  /** 初始化每日单词 */
  function initDailyWords() {
    todayDateStr = getTodayString();
    const record = loadStorage(STORAGE_KEY_DAILY, null);

    if (record && record.date === todayDateStr && Array.isArray(record.ids)) {
      // 今日已抽过词，按 ID 从题库中取出
      todayWords = record.ids
        .map(id => wordBank.find(w => w.id === id))
        .filter(Boolean);

      // 如果题库被用户删了一些词，导致今日单词不足，补齐
      if (todayWords.length < DAILY_COUNT && wordBank.length > todayWords.length) {
        const existingIds = new Set(todayWords.map(w => w.id));
        const pool = wordBank.filter(w => !existingIds.has(w.id));
        const need = DAILY_COUNT - todayWords.length;
        const picked = shuffle(pool).slice(0, need);
        todayWords = todayWords.concat(picked);
        record.ids = todayWords.map(w => w.id);
        saveStorage(STORAGE_KEY_DAILY, record);
      }
    } else {
      // 新的一天，重新抽取
      pickDailyWords();
    }
  }

  /** 从题库中随机抽取今日单词 */
  function pickDailyWords() {
    if (wordBank.length === 0) {
      todayWords = [];
      return;
    }
    const count = Math.min(DAILY_COUNT, wordBank.length);
    todayWords = shuffle(wordBank).slice(0, count);
    const record = {
      date: todayDateStr,
      ids: todayWords.map(w => w.id)
    };
    saveStorage(STORAGE_KEY_DAILY, record);
  }

  // ========== 视图切换 ==========

  function switchView(viewName) {
    // 更新导航
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    // 更新视图
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
    });
    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');

    // 进入不同视图时的刷新
    if (viewName === 'home') {
      renderHomePage();
    } else if (viewName === 'manage') {
      renderManagePage();
    } else if (viewName === 'print') {
      renderPrintPage();
    }

    // 滚动到顶部
    window.scrollTo(0, 0);
  }

  // ========== 主页渲染 ==========

  function renderHomePage() {
    document.getElementById('todayDate').textContent = formatDateReadable(todayDateStr);
    document.getElementById('todayCount').textContent = `${todayWords.length} / ${DAILY_COUNT}`;
    document.getElementById('totalCount').textContent = wordBank.length;
    document.getElementById('wordListSubtitle').textContent = `共 ${todayWords.length} 个单词`;

    // 更新按钮文字
    const toggleBtn = document.getElementById('btnToggleMeaning');
    toggleBtn.textContent = showMeaning ? '隐藏中文释义' : '显示中文释义';

    const list = document.getElementById('todayWordList');
    list.innerHTML = '';

    if (todayWords.length === 0) {
      list.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#8a94a6;padding:40px 0;">题库为空，请先在「题库管理」中添加单词</p>';
      return;
    }

    todayWords.forEach((w, idx) => {
      const card = document.createElement('div');
      card.className = 'word-card';
      card.innerHTML = `
        <span class="word-card-index">${idx + 1}</span>
        <div class="word-card-word">${escapeHtml(w.word)}</div>
        <div class="word-card-phonetic">${escapeHtml(w.phonetic || '')}</div>
        <div>
          ${w.pos ? `<span class="word-card-pos">${escapeHtml(w.pos)}</span>` : ''}
        </div>
        <div class="word-card-meaning ${showMeaning ? '' : 'hidden'}">${escapeHtml(w.meaning || '')}</div>
      `;
      list.appendChild(card);
    });
  }

  // ========== 题库管理页渲染 ==========

  function renderManagePage() {
    document.getElementById('manageTotalCount').textContent = wordBank.length;

    const tbody = document.getElementById('wordTableBody');
    const emptyBox = document.getElementById('tableEmpty');
    tbody.innerHTML = '';

    // 搜索过滤
    const keyword = searchKeyword.trim().toLowerCase();
    let filtered = wordBank;
    if (keyword) {
      filtered = wordBank.filter(w =>
        (w.word || '').toLowerCase().includes(keyword) ||
        (w.meaning || '').toLowerCase().includes(keyword) ||
        (w.phonetic || '').toLowerCase().includes(keyword)
      );
    }

    if (filtered.length === 0) {
      emptyBox.style.display = 'block';
      return;
    }
    emptyBox.style.display = 'none';

    filtered.forEach((w, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td class="word-en">${escapeHtml(w.word)}</td>
        <td class="phonetic">${escapeHtml(w.phonetic || '')}</td>
        <td class="pos">${escapeHtml(w.pos || '')}</td>
        <td>${escapeHtml(w.meaning || '')}</td>
        <td class="table-actions no-print">
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${w.id}">编辑</button>
          <button class="btn btn-outline btn-sm" data-action="delete" data-id="${w.id}">删除</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ========== 打印页渲染 ==========

  function renderPrintPage() {
    document.getElementById('a4Date').textContent = formatDateReadable(todayDateStr);

    const tbody = document.getElementById('a4TableBody');
    tbody.innerHTML = '';

    // 打印页显示 50 行，不足用空行补齐
    const rows = Math.max(DAILY_COUNT, todayWords.length);
    for (let i = 0; i < rows; i++) {
      const w = todayWords[i];
      const tr = document.createElement('tr');
      if (w) {
        tr.innerHTML = `
          <td class="num-col">${i + 1}</td>
          <td class="word-col">${escapeHtml(w.word)}</td>
          <td class="phonetic-col">${escapeHtml(w.phonetic || '')}</td>
          <td class="pos-col">${escapeHtml(w.pos || '')}</td>
          <td class="meaning-col ${printShowMeaning ? '' : 'hidden'}">${escapeHtml(w.meaning || '')}</td>
        `;
      } else {
        tr.innerHTML = `
          <td class="num-col">${i + 1}</td>
          <td class="word-col"></td>
          <td class="phonetic-col"></td>
          <td class="pos-col"></td>
          <td class="meaning-col"></td>
        `;
      }
      tbody.appendChild(tr);
    }

    // 更新按钮文字
    const toggleBtn = document.getElementById('btnPrintToggle');
    toggleBtn.textContent = printShowMeaning ? '隐藏中文释义' : '显示中文释义';
  }

  // ========== 单词增删改 ==========

  function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent = '添加单词';
    document.getElementById('wordForm').reset();
    document.getElementById('wordId').value = '';
    showModal('wordModal');
  }

  function openEditModal(id) {
    const w = wordBank.find(x => x.id === id);
    if (!w) return;
    editingId = id;
    document.getElementById('modalTitle').textContent = '编辑单词';
    document.getElementById('wordId').value = w.id;
    document.getElementById('formWord').value = w.word || '';
    document.getElementById('formPhonetic').value = w.phonetic || '';
    document.getElementById('formPos').value = w.pos || '';
    document.getElementById('formMeaning').value = w.meaning || '';
    showModal('wordModal');
  }

  function saveWord() {
    const word = document.getElementById('formWord').value.trim();
    const phonetic = document.getElementById('formPhonetic').value.trim();
    const pos = document.getElementById('formPos').value.trim();
    const meaning = document.getElementById('formMeaning').value.trim();

    if (!word) {
      showToast('请输入单词', 'error');
      return;
    }
    if (!meaning) {
      showToast('请输入中文释义', 'error');
      return;
    }

    if (editingId) {
      // 编辑
      const idx = wordBank.findIndex(w => w.id === editingId);
      if (idx >= 0) {
        wordBank[idx] = { ...wordBank[idx], word, phonetic, pos, meaning };
        showToast('单词已更新', 'success');
      }
    } else {
      // 新增
      const newWord = { id: nextId(), word, phonetic, pos, meaning };
      wordBank.push(newWord);
      showToast('单词已添加', 'success');
    }

    // 持久化
    saveStorage(STORAGE_KEY_WORDS, wordBank);

    // 同步更新今日单词（如果有被编辑的单词在今日列表里）
    syncTodayWordsFromBank();

    // 刷新当前视图
    const activeView = document.querySelector('.nav-btn.active');
    if (activeView) {
      if (activeView.dataset.view === 'manage') renderManagePage();
      else if (activeView.dataset.view === 'home') renderHomePage();
      else if (activeView.dataset.view === 'print') renderPrintPage();
    }

    hideModal('wordModal');
  }

  function deleteWord(id) {
    const w = wordBank.find(x => x.id === id);
    if (!w) return;
    showConfirm('删除单词', `确定要删除单词「${w.word}」吗？此操作不可撤销。`, () => {
      wordBank = wordBank.filter(x => x.id !== id);
      saveStorage(STORAGE_KEY_WORDS, wordBank);

      // 同步从今日单词中移除
      todayWords = todayWords.filter(x => x.id !== id);
      // 如果今日单词不足，尝试补一个
      if (todayWords.length < DAILY_COUNT && wordBank.length > 0) {
        const existingIds = new Set(todayWords.map(w => w.id));
        const pool = wordBank.filter(w => !existingIds.has(w.id));
        if (pool.length > 0) {
          const picked = shuffle(pool).slice(0, DAILY_COUNT - todayWords.length);
          todayWords = todayWords.concat(picked);
        }
      }
      const record = loadStorage(STORAGE_KEY_DAILY, {});
      record.date = todayDateStr;
      record.ids = todayWords.map(w => w.id);
      saveStorage(STORAGE_KEY_DAILY, record);

      renderManagePage();
      showToast('单词已删除', 'success');
    });
  }

  /** 用题库中的最新数据同步更新今日单词列表 */
  function syncTodayWordsFromBank() {
    todayWords = todayWords.map(tw => {
      const latest = wordBank.find(w => w.id === tw.id);
      return latest || tw;
    });
    // 更新存储
    const record = loadStorage(STORAGE_KEY_DAILY, {});
    record.date = todayDateStr;
    record.ids = todayWords.map(w => w.id);
    saveStorage(STORAGE_KEY_DAILY, record);
  }

  function resetToDefault() {
    showConfirm('恢复默认题库', '确定要将题库恢复为默认状态吗？你所有的自定义修改都会丢失。', async () => {
      // 清除自定义存储，重新加载内置
      localStorage.removeItem(STORAGE_KEY_WORDS);
      localStorage.removeItem(STORAGE_KEY_DAILY);
      wordBank = await loadBuiltinWords();
      if (wordBank.length > 0) {
        saveStorage(STORAGE_KEY_WORDS, wordBank);
      }
      // 重新抽词
      pickDailyWords();
      renderManagePage();
      showToast('已恢复默认题库', 'success');
    });
  }

  // ========== 弹窗控制 ==========

  function showModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  }

  /** 显示确认弹窗 */
  let confirmCallback = null;
  function showConfirm(title, message, onOk) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = onOk;
    showModal('confirmModal');
  }

  // ========== HTML 转义 ==========
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ========== 事件绑定 ==========

  function bindEvents() {
    // 导航切换
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchView(btn.dataset.view);
      });
    });

    // 主页 - 重新抽词
    document.getElementById('btnRefreshWords').addEventListener('click', () => {
      showConfirm('重新抽取', '确定要重新抽取今日 50 个单词吗？当前的今日单词会被替换。', () => {
        pickDailyWords();
        renderHomePage();
        showToast('已重新抽取今日单词', 'success');
      });
    });

    // 主页 - 显示/隐藏释义
    document.getElementById('btnToggleMeaning').addEventListener('click', () => {
      showMeaning = !showMeaning;
      renderHomePage();
    });

    // 主页 - 前往打印预览
    document.getElementById('btnGoPrint').addEventListener('click', () => {
      switchView('print');
    });

    // 管理页 - 搜索
    const searchInput = document.getElementById('searchInput');
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchKeyword = searchInput.value;
        renderManagePage();
      }, 150);
    });

    // 管理页 - 添加单词
    document.getElementById('btnAddWord').addEventListener('click', openAddModal);

    // 管理页 - 恢复默认
    document.getElementById('btnResetWords').addEventListener('click', resetToDefault);

    // 管理页 - 表格操作（事件委托）
    document.getElementById('wordTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'edit') {
        openEditModal(id);
      } else if (btn.dataset.action === 'delete') {
        deleteWord(id);
      }
    });

    // 单词弹窗 - 关闭
    document.getElementById('modalClose').addEventListener('click', () => hideModal('wordModal'));
    document.getElementById('modalCancel').addEventListener('click', () => hideModal('wordModal'));
    document.querySelector('#wordModal .modal-mask').addEventListener('click', () => hideModal('wordModal'));

    // 单词弹窗 - 保存
    document.getElementById('modalSave').addEventListener('click', saveWord);

    // 表单回车保存
    document.getElementById('wordForm').addEventListener('submit', (e) => {
      e.preventDefault();
      saveWord();
    });

    // 确认弹窗 - 取消/确定
    document.getElementById('confirmCancel').addEventListener('click', () => {
      hideModal('confirmModal');
      confirmCallback = null;
    });
    document.getElementById('confirmOk').addEventListener('click', () => {
      hideModal('confirmModal');
      if (typeof confirmCallback === 'function') {
        confirmCallback();
        confirmCallback = null;
      }
    });
    document.querySelector('#confirmModal .modal-mask').addEventListener('click', () => {
      hideModal('confirmModal');
      confirmCallback = null;
    });

    // 打印页 - 打印按钮
    document.getElementById('btnDoPrint').addEventListener('click', () => {
      window.print();
    });

    // 打印页 - 显示/隐藏释义
    document.getElementById('btnPrintToggle').addEventListener('click', () => {
      printShowMeaning = !printShowMeaning;
      renderPrintPage();
    });

    // 打印页 - 返回
    document.getElementById('btnPrintBack').addEventListener('click', () => {
      switchView('home');
    });

    // ESC 关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideModal('wordModal');
        hideModal('confirmModal');
      }
    });
  }

  // ========== 应用初始化 ==========

  async function init() {
    await initWordBank();
    initDailyWords();
    bindEvents();
    renderHomePage();
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

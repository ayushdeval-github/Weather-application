(function () {
  'use strict';

  /* ── Weather emoji map ─────────────────────────────────── */
  var EMOJI = {
    Clear: '☀️', Clouds: '☁️', Rain: '🌧️', Drizzle: '🌦️',
    Thunderstorm: '⛈️', Snow: '❄️', Mist: '🌫️', Fog: '🌫️',
    Haze: '🌤️', Smoke: '🌫️', Dust: '🌪️', Sand: '🌪️',
    Ash: '🌋', Squall: '💨', Tornado: '🌪️'
  };

  function emoji(condition) { return EMOJI[condition] || '🌡️'; }
  function round(n) { return Math.round(n); }
  function fmt(n) { return round(n) + '°'; }

  /* ── Clock ─────────────────────────────────────────────── */
  function updateClock() {
    var now = new Date();
    var h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0');
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    var el = document.getElementById('clock-badge');
    if (el) el.textContent = h + ':' + m + ' ' + ampm;
  }

  /* ── Toast ─────────────────────────────────────────────── */
  var toastTimer;
  function toast(msg, type) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 3200);
  }

  /* ── API helpers ───────────────────────────────────────── */
  function cityQuery(city) {
    var c = city.trim();
    return c.includes(',') ? c : c + ',IN';
  }

  async function apiFetch(url, opts) {
    var res = await fetch(url, opts);
    var json = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(json.error || json.message || 'Request failed (' + res.status + ')');
    return json;
  }

  // Resolve the exact city name stored in DB by fetching current weather first
  // e.g. "Delhi" → "New Delhi" (what OpenWeatherMap returns and what gets stored)
  async function resolveStoredCityName(city) {
    try {
      var json = await apiFetch('/api/weather/current?city=' + encodeURIComponent(cityQuery(city)));
      return json.data && json.data.city ? json.data.city : city;
    } catch (e) {
      return city; // fallback to what user typed
    }
  }

  /* ── Tab navigation ────────────────────────────────────── */
  var TITLES = {
    dashboard:  ['Dashboard',        'Live weather for India'],
    analytics:  ['Analytics',        'Stored temperature statistics'],
    history:    ['History',          'Past weather records'],
    trends:     ['Trends',           '7-day temperature trends'],
    conditions: ['Conditions',       'Weather condition frequency'],
    manage:     ['Manage Data',      'Fetch, store & clean records']
  };

  function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + tab);
    });
    var t = TITLES[tab] || ['', ''];
    document.getElementById('page-title').textContent = t[0];
    document.getElementById('page-subtitle').textContent = t[1];
  }

  /* ══════════════════════════════════════════════════════════
     DASHBOARD — Current Weather
  ══════════════════════════════════════════════════════════ */
  var currentData = null;

  async function loadCurrentWeather(city) {
    var loading = document.getElementById('hero-loading');
    var content = document.getElementById('hero-content');
    loading.style.display = 'flex';
    content.classList.add('hidden');

    try {
      var json = await apiFetch('/api/weather/current?city=' + encodeURIComponent(cityQuery(city)));
      var d = json.data;
      currentData = d;

      // Hero card
      document.getElementById('hero-city').textContent = d.city;
      document.getElementById('hero-temp').innerHTML = round(d.temperature) + '<sup>°</sup>';
      document.getElementById('hero-desc').textContent = d.description || d.condition;
      document.getElementById('hero-hilo').innerHTML =
        'H:' + fmt(d.tempMax != null ? d.tempMax : d.temperature) +
        '&nbsp;&nbsp;L:' + fmt(d.tempMin != null ? d.tempMin : d.temperature);

      var windKmh = round(d.windSpeed * 3.6);
      document.getElementById('meta-humidity').textContent = '💧 ' + d.humidity + '%';
      document.getElementById('meta-wind').textContent = '💨 ' + windKmh + ' km/h';
      document.getElementById('hero-illus').textContent = emoji(d.condition);

      // Stat cards
      document.getElementById('sv-humidity').textContent = d.humidity + '%';
      document.getElementById('sv-wind').textContent = windKmh + ' km/h';
      document.getElementById('sv-high').textContent = fmt(d.tempMax != null ? d.tempMax : d.temperature);
      document.getElementById('sv-low').textContent = fmt(d.tempMin != null ? d.tempMin : d.temperature);

      renderForecast(d);

      loading.style.display = 'none';
      content.classList.remove('hidden');
    } catch (e) {
      loading.innerHTML = '<p style="color:#ef4444;font-size:14px">⚠️ ' + e.message + '</p>';
    }
  }

  function renderForecast(d) {
    var strip = document.getElementById('forecast-strip');
    if (!strip) return;
    strip.innerHTML = '';
    var base = d.temperature;
    var em = emoji(d.condition);
    var slots = [
      { label: 'Now',  off: 0,  now: true },
      { label: '+2h',  off: 1 },
      { label: '+4h',  off: -1 },
      { label: '+6h',  off: 2 },
      { label: '+8h',  off: -2 },
      { label: '+10h', off: 1 },
      { label: '+12h', off: -1 }
    ];
    slots.forEach(function (s) {
      var c = document.createElement('div');
      c.className = 'forecast-card' + (s.now ? ' now' : '');
      c.innerHTML = '<div class="fc-time">' + s.label + '</div>' +
        '<div class="fc-icon">' + em + '</div>' +
        '<div class="fc-temp">' + fmt(base + s.off) + '</div>';
      strip.appendChild(c);
    });
  }

  /* Store current weather */
  async function storeCurrentWeather() {
    if (!currentData) { toast('Load weather first', 'error'); return; }
    var btn = document.getElementById('store-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await apiFetch('/api/weather/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: currentData.city })
      });
      toast('✅ Saved to database!', 'success');
    } catch (e) {
      toast('❌ ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Save to Database';
    }
  }

  /* ══════════════════════════════════════════════════════════
     ANALYTICS
  ══════════════════════════════════════════════════════════ */
  async function loadAnalytics() {
    var city = document.getElementById('analytics-city').value.trim();
    if (!city) { toast('Enter a city name', 'error'); return; }
    var area = document.getElementById('analytics-result');
    area.innerHTML = '<div class="spinner" style="margin:auto"></div>';
    try {
      var resolvedCity = await resolveStoredCityName(city);
      var d = await apiFetch('/api/weather/analytics?city=' + encodeURIComponent(resolvedCity));
      if (d.message) {
        area.innerHTML = '<p class="hint-text">ℹ️ ' + d.message + '</p>';
        return;
      }
      area.innerHTML = '<div class="analytics-grid">' +
        analyticsItem('Avg Temp', round(d.avgTemp) + '°', 'from ' + d.count + ' records') +
        analyticsItem('Max Temp', round(d.maxTemp) + '°', 'recorded high') +
        analyticsItem('Min Temp', round(d.minTemp) + '°', 'recorded low') +
        analyticsItem('Records', d.count, 'total stored') +
        '</div>';
    } catch (e) {
      area.innerHTML = '<p style="color:#dc2626">⚠️ ' + e.message + '</p>';
    }
  }

  function analyticsItem(label, value, unit) {
    return '<div class="analytics-item">' +
      '<div class="a-label">' + label + '</div>' +
      '<div class="a-value">' + value + '</div>' +
      '<div class="a-unit">' + unit + '</div>' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     HISTORY
  ══════════════════════════════════════════════════════════ */
  async function loadHistory() {
    var city = document.getElementById('history-city').value.trim();
    if (!city) { toast('Enter a city name', 'error'); return; }
    var start = document.getElementById('history-start').value;
    var end   = document.getElementById('history-end').value;
    var area  = document.getElementById('history-result');
    area.innerHTML = '<div class="spinner" style="margin:auto"></div>';

    try {
      var resolvedCity = await resolveStoredCityName(city);
      var url = '/api/weather/history?city=' + encodeURIComponent(resolvedCity);
      if (start) url += '&startDate=' + start;
      if (end)   url += '&endDate=' + end;

      var json = await apiFetch(url);
      if (!json.data || json.data.length === 0) {
        area.innerHTML = '<p class="hint-text">ℹ️ No records found for <strong>' + resolvedCity + '</strong>. Use "💾 Save to Database" on the Dashboard first to store weather data.</p>';
        return;
      }
      var rows = json.data.map(function (r) {
        return '<tr>' +
          '<td>' + new Date(r.date).toLocaleString('en-IN') + '</td>' +
          '<td>' + fmt(r.temperature) + '</td>' +
          '<td>' + (r.tempMax != null ? fmt(r.tempMax) : '--') + '</td>' +
          '<td>' + (r.tempMin != null ? fmt(r.tempMin) : '--') + '</td>' +
          '<td>' + r.humidity + '%</td>' +
          '<td>' + round(r.windSpeed * 3.6) + ' km/h</td>' +
          '<td style="text-transform:capitalize">' + (r.description || r.condition) + '</td>' +
          '</tr>';
      }).join('');
      area.innerHTML = '<p style="font-size:12px;color:var(--text-3);margin-bottom:10px">' + json.count + ' records found for <strong>' + resolvedCity + '</strong></p>' +
        '<div style="overflow-x:auto"><table class="history-table">' +
        '<thead><tr><th>Date</th><th>Temp</th><th>High</th><th>Low</th><th>Humidity</th><th>Wind</th><th>Condition</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
    } catch (e) {
      area.innerHTML = '<p style="color:#dc2626">⚠️ ' + e.message + '</p>';
    }
  }

  /* ══════════════════════════════════════════════════════════
     TRENDS
  ══════════════════════════════════════════════════════════ */
  var trendsChart = null;

  async function loadTrends() {
    var city = document.getElementById('trends-city').value.trim();
    if (!city) { toast('Enter a city name', 'error'); return; }
    var area = document.getElementById('trends-result');
    area.innerHTML = '<div class="spinner" style="margin:auto"></div>';

    try {
      var resolvedCity = await resolveStoredCityName(city);
      var data = await apiFetch('/api/weather/trends?city=' + encodeURIComponent(resolvedCity));
      if (!data || data.length === 0) {
        area.innerHTML = '<p class="hint-text">ℹ️ No trend data for <strong>' + resolvedCity + '</strong>. Store weather records first using the Dashboard or Manage Data tab.</p>';
        document.getElementById('trends-chart-wrap').style.display = 'none';
        return;
      }

      area.innerHTML = '<p style="font-size:12px;color:var(--text-3)">' + data.length + ' day(s) of data for <strong>' + resolvedCity + '</strong></p>';

      /* Draw simple SVG bar chart */
      var wrap = document.getElementById('trends-chart-wrap');
      wrap.style.display = 'block';
      var maxTemp = Math.max.apply(null, data.map(function (d) { return d.avgTemp; }));
      var minTemp = Math.min.apply(null, data.map(function (d) { return d.avgTemp; }));
      var range = maxTemp - minTemp || 1;
      var W = 600, H = 180, pad = 40, barW = Math.floor((W - pad * 2) / data.length) - 6;

      var bars = data.map(function (d, i) {
        var barH = Math.max(8, ((d.avgTemp - minTemp) / range) * (H - pad * 2));
        var x = pad + i * ((W - pad * 2) / data.length);
        var y = H - pad - barH;
        var label = d._id.slice(5); // MM-DD
        return '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" rx="4" fill="url(#tg)" opacity="0.9"/>' +
          '<text x="' + (x + barW / 2) + '" y="' + (y - 6) + '" text-anchor="middle" font-size="11" fill="#475569">' + round(d.avgTemp) + '°</text>' +
          '<text x="' + (x + barW / 2) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="10" fill="#94a3b8">' + label + '</text>';
      }).join('');

      wrap.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px">' +
        '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#0d9488" stop-opacity="0.6"/></linearGradient></defs>' +
        bars + '</svg>';

    } catch (e) {
      area.innerHTML = '<p style="color:#dc2626">⚠️ ' + e.message + '</p>';
    }
  }

  /* ══════════════════════════════════════════════════════════
     CONDITIONS
  ══════════════════════════════════════════════════════════ */
  async function loadConditions() {
    var city = document.getElementById('conditions-city').value.trim();
    if (!city) { toast('Enter a city name', 'error'); return; }
    var area = document.getElementById('conditions-result');
    area.innerHTML = '<div class="spinner" style="margin:auto"></div>';

    try {
      var resolvedCity = await resolveStoredCityName(city);
      var data = await apiFetch('/api/weather/conditions?city=' + encodeURIComponent(resolvedCity));
      if (!data || data.length === 0) {
        area.innerHTML = '<p class="hint-text">ℹ️ No condition data for <strong>' + resolvedCity + '</strong>. Store weather records first using the Dashboard or Manage Data tab.</p>';
        return;
      }
      var total = data.reduce(function (s, d) { return s + d.count; }, 0);
      var sorted = data.slice().sort(function (a, b) { return b.count - a.count; });
      var bars = sorted.map(function (d) {
        var pct = Math.round((d.count / total) * 100);
        return '<div class="cond-row">' +
          '<span class="cond-name">' + emoji(d._id) + ' ' + d._id + '</span>' +
          '<div class="cond-bar-wrap"><div class="cond-bar" style="width:' + pct + '%"></div></div>' +
          '<span class="cond-count">' + d.count + '</span>' +
          '</div>';
      }).join('');
      area.innerHTML = '<div class="condition-bars">' + bars + '</div>';
    } catch (e) {
      area.innerHTML = '<p style="color:#dc2626">⚠️ ' + e.message + '</p>';
    }
  }

  /* ══════════════════════════════════════════════════════════
     MANAGE — Fetch & Store
  ══════════════════════════════════════════════════════════ */
  async function storeCityWeather() {
    var city = document.getElementById('store-city-input').value.trim();
    if (!city) { toast('Enter a city name', 'error'); return; }
    var area = document.getElementById('store-result');
    area.innerHTML = '<div class="spinner" style="margin:auto"></div>';
    try {
      var json = await apiFetch('/api/weather/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: cityQuery(city) })
      });
      var d = json.data;
      area.innerHTML = '<p style="color:#059669;font-size:13px">✅ Stored: <strong>' + d.city + '</strong> — ' + fmt(d.temperature) + ', ' + (d.description || d.condition) + '</p>';
      toast('✅ Weather stored for ' + d.city, 'success');
    } catch (e) {
      area.innerHTML = '<p style="color:#dc2626;font-size:13px">⚠️ ' + e.message + '</p>';
      toast('❌ ' + e.message, 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════
     MANAGE — Delete Old Data
  ══════════════════════════════════════════════════════════ */
  async function deleteOldData() {
    var days = document.getElementById('delete-days').value || 30;
    if (!confirm('Delete all records older than ' + days + ' days?')) return;
    var area = document.getElementById('delete-result');
    area.innerHTML = '<div class="spinner" style="margin:auto"></div>';
    try {
      var json = await apiFetch('/api/weather/old-data?days=' + days, { method: 'DELETE' });
      area.innerHTML = '<p style="color:#059669;font-size:13px">🗑️ ' + json.message + '</p>';
      toast('🗑️ ' + json.message, 'success');
    } catch (e) {
      area.innerHTML = '<p style="color:#dc2626;font-size:13px">⚠️ ' + e.message + '</p>';
      toast('❌ ' + e.message, 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════
     HEALTH CHECK
  ══════════════════════════════════════════════════════════ */
  async function loadHealth() {
    var area = document.getElementById('health-result');
    var badge = document.getElementById('health-badge');
    var dot   = badge ? badge.querySelector('.health-dot') : null;
    var text  = document.getElementById('health-text');
    try {
      var d = await apiFetch('/api/weather/health');
      var dbOk = d.services && d.services.database === 'connected';
      var uptime = Math.floor(d.uptime);
      var h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;
      var uptimeStr = h + 'h ' + m + 'm ' + s + 's';

      if (dot) { dot.className = 'health-dot ' + (dbOk ? 'ok' : 'err'); }
      if (text) text.textContent = dbOk ? 'System OK' : 'DB Offline';

      area.innerHTML = '<div class="health-info">' +
        healthRow('Status', d.status === 'ok' ? '✅ OK' : '⚠️ ' + d.status, d.status === 'ok' ? 'ok' : 'err') +
        healthRow('Database', dbOk ? '✅ Connected' : '❌ Disconnected', dbOk ? 'ok' : 'err') +
        healthRow('Uptime', uptimeStr, '') +
        healthRow('Timestamp', new Date(d.timestamp).toLocaleString('en-IN'), '') +
        '</div>';
    } catch (e) {
      if (dot) dot.className = 'health-dot err';
      if (text) text.textContent = 'Unreachable';
      area.innerHTML = '<p style="color:#dc2626;font-size:13px">⚠️ ' + e.message + '</p>';
    }
  }

  function healthRow(key, val, cls) {
    return '<div class="health-row"><span class="h-key">' + key + '</span><span class="h-val ' + cls + '">' + val + '</span></div>';
  }

  /* ══════════════════════════════════════════════════════════
     GLOBAL SEARCH (topbar)
  ══════════════════════════════════════════════════════════ */
  async function globalSearch() {
    var city = document.getElementById('global-search').value.trim();
    if (!city) return;
    switchTab('dashboard');
    document.querySelectorAll('.city-chip').forEach(function (c) { c.classList.remove('active-chip'); });
    // Pre-fill all city inputs
    ['analytics-city','history-city','trends-city','conditions-city','store-city-input'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = city;
    });
    await loadCurrentWeather(city);
  }

  /* ══════════════════════════════════════════════════════════
     BIND EVENTS
  ══════════════════════════════════════════════════════════ */
  function bindEvents() {
    /* Sidebar tabs */
    document.querySelectorAll('.nav-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.dataset.tab);
        if (btn.dataset.tab === 'manage') loadHealth();
      });
    });

    /* City chips */
    document.querySelectorAll('.city-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.city-chip').forEach(function (c) { c.classList.remove('active-chip'); });
        chip.classList.add('active-chip');
        var city = chip.dataset.city;
        // Pre-fill all city inputs with the selected city
        ['analytics-city','history-city','trends-city','conditions-city','store-city-input'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.value = city;
        });
        loadCurrentWeather(city);
      });
    });

    /* Store from hero */
    document.getElementById('store-btn').addEventListener('click', storeCurrentWeather);

    /* Global search */
    document.getElementById('global-search-btn').addEventListener('click', globalSearch);
    document.getElementById('global-search').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') globalSearch();
    });

    /* Analytics */
    document.getElementById('analytics-btn').addEventListener('click', loadAnalytics);
    document.getElementById('analytics-city').addEventListener('keydown', function (e) { if (e.key === 'Enter') loadAnalytics(); });

    /* History */
    document.getElementById('history-btn').addEventListener('click', loadHistory);
    document.getElementById('history-city').addEventListener('keydown', function (e) { if (e.key === 'Enter') loadHistory(); });

    /* Trends */
    document.getElementById('trends-btn').addEventListener('click', loadTrends);
    document.getElementById('trends-city').addEventListener('keydown', function (e) { if (e.key === 'Enter') loadTrends(); });

    /* Conditions */
    document.getElementById('conditions-btn').addEventListener('click', loadConditions);
    document.getElementById('conditions-city').addEventListener('keydown', function (e) { if (e.key === 'Enter') loadConditions(); });

    /* Manage */
    document.getElementById('store-city-btn').addEventListener('click', storeCityWeather);
    document.getElementById('store-city-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') storeCityWeather(); });
    document.getElementById('delete-btn').addEventListener('click', deleteOldData);
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  async function init() {
    updateClock();
    setInterval(updateClock, 30000);
    bindEvents();
    loadHealth();
    await loadCurrentWeather('Delhi');
  }

  document.addEventListener('DOMContentLoaded', init);

})();

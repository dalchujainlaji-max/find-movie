const GENRES = [
  "剧情", "喜剧", "爱情", "动作", "犯罪", "悬疑", "惊悚", "恐怖", "科幻", "奇幻", "冒险",
  "动画", "家庭", "战争", "历史", "传记", "音乐", "歌舞", "纪录片", "短片", "同性", "灾难",
  "运动", "西部", "古装", "武侠"
];

const STORE_KEYS = {
  additions: "trashMovieList.additions.v1",
  comments: "trashMovieList.comments.v1",
};

const state = {
  baseMovies: [],
  movies: [],
  comments: loadStore(STORE_KEYS.comments, {}),
  activeGenre: "全部",
  activeFilter: "all",
  query: "",
  todayPick: null,
};

const els = {
  todayTitle: document.querySelector("#todayTitle"),
  todayMeta: document.querySelector("#todayMeta"),
  shufflePick: document.querySelector("#shufflePick"),
  openTodayDetail: document.querySelector("#openTodayDetail"),
  searchInput: document.querySelector("#searchInput"),
  genreStrip: document.querySelector(".genre-strip"),
  movieList: document.querySelector("#movieList"),
  resultCount: document.querySelector("#resultCount"),
  listTitle: document.querySelector("#listTitle"),
  detailDialog: document.querySelector("#detailDialog"),
  detailContent: document.querySelector("#detailContent"),
  closeDetail: document.querySelector("#closeDetail"),
  addDialog: document.querySelector("#addDialog"),
  openAdd: document.querySelector("#openAdd"),
  closeAdd: document.querySelector("#closeAdd"),
  addForm: document.querySelector("#addForm"),
};

init();

async function init() {
  clearLocalDataFromUrl();
  const response = await fetch("./data/movies.json");
  state.baseMovies = await response.json();
  state.movies = normalizeMovies([...state.baseMovies, ...loadStore(STORE_KEYS.additions, [])]);
  renderGenres();
  renderGenreOptions();
  bindEvents();
  pickToday();
  render();
}

function clearLocalDataFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset") !== "1") return;
  localStorage.removeItem(STORE_KEYS.additions);
  localStorage.removeItem(STORE_KEYS.comments);
  window.history.replaceState({}, "", window.location.pathname);
}

function normalizeMovies(rows) {
  return rows
    .filter((row) => row["是否添加到网页"] !== "否")
    .map((row, index) => ({
      id: row.id || `movie-${row["序号"] || index + 1}-${row["片名_待确认"]}`,
      title: row["片名_待确认"] || row.title || "未命名",
      recommended: row["我推荐"] === "是" || row.recommended === true,
      mediaType: row["影视类型_待补全"] || row.mediaType || "待确认",
      genres: splitList(row["类型分类_待补全"] || row.genres || ""),
      year: row["年份_待补全"] || row.year || "",
      country: row["国家地区_待补全"] || row.country || "",
      watchDate: row["观看日期_推断"] || row.watchDate || "",
      note: row["备注_原文"] || row.note || "",
      sourceNote: row["需人工确认点"] || "",
      confidence: row["资料置信度_v5"] || "",
      addedByUser: row.addedByUser || false,
    }));
}

function splitList(value) {
  if (Array.isArray(value)) return value;
  return String(value)
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function bindEvents() {
  els.shufflePick.addEventListener("click", () => {
    pickToday(true);
  });
  els.openTodayDetail.addEventListener("click", () => {
    if (state.todayPick) openDetail(state.todayPick.id);
  });
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    render();
  });
  document.querySelectorAll(".segmented-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segmented-button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.activeFilter = button.dataset.filter;
      render();
    });
  });
  els.genreStrip.addEventListener("click", (event) => {
    const button = event.target.closest(".genre-chip");
    if (!button) return;
    els.genreStrip.querySelectorAll(".genre-chip").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.activeGenre = button.dataset.genre;
    render();
  });
  els.movieList.addEventListener("click", (event) => {
    const card = event.target.closest(".movie-card");
    if (card) openDetail(card.dataset.id);
  });
  els.closeDetail.addEventListener("click", () => els.detailDialog.close());
  els.openAdd.addEventListener("click", openAddDialog);
  els.closeAdd.addEventListener("click", () => els.addDialog.close());
  els.addForm.addEventListener("submit", handleAddMovie);
}

function renderGenres() {
  GENRES.forEach((genre) => {
    const button = document.createElement("button");
    button.className = "genre-chip";
    button.dataset.genre = genre;
    button.type = "button";
    button.textContent = genre;
    els.genreStrip.appendChild(button);
  });
}

function renderGenreOptions() {
  const select = els.addForm.elements.genre;
  GENRES.forEach((genre) => {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    select.appendChild(option);
  });
}

function pickToday(force = false) {
  const pool = state.movies.filter((movie) => movie.recommended);
  if (!pool.length) return;
  const lastId = state.todayPick?.id;
  let next = pool[Math.floor(Math.random() * pool.length)];
  if (force && pool.length > 1) {
    while (next.id === lastId) next = pool[Math.floor(Math.random() * pool.length)];
  }
  state.todayPick = next;
  els.todayTitle.textContent = next.title;
  els.todayMeta.textContent = makeMeta(next);
}

function render() {
  const movies = filteredMovies();
  els.resultCount.textContent = `${movies.length} 部`;
  els.listTitle.textContent = state.activeGenre === "全部" ? "全部作品" : `${state.activeGenre}片`;

  if (!movies.length) {
    els.movieList.innerHTML = `<div class="empty-state">没有找到合适的片，换个类型或关键词试试。</div>`;
    return;
  }

  els.movieList.innerHTML = movies.map(renderCard).join("");
}

function filteredMovies() {
  const query = state.query.toLowerCase();
  return state.movies
    .filter((movie) => state.activeFilter !== "recommended" || movie.recommended)
    .filter((movie) => state.activeGenre === "全部" || movie.genres.includes(state.activeGenre))
    .filter((movie) => {
      if (!query) return true;
      const haystack = [movie.title, movie.country, movie.note, movie.year, movie.mediaType, movie.genres.join(" ")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || (b.watchDate || "").localeCompare(a.watchDate || ""));
}

function renderCard(movie) {
  return `
    <article class="movie-card" data-id="${escapeAttr(movie.id)}">
      <div class="card-top">
        <div>
          <h3 class="card-title">${escapeHtml(movie.title)}</h3>
          <p class="meta">${escapeHtml(makeMeta(movie))}</p>
        </div>
        ${movie.recommended ? `<span class="badge">我推荐</span>` : ""}
      </div>
      ${movie.note ? `<p class="note">${escapeHtml(movie.note)}</p>` : ""}
    </article>
  `;
}

function makeMeta(movie) {
  const parts = [
    movie.year,
    movie.country,
    movie.mediaType,
    movie.genres.join("、"),
  ].filter(Boolean);
  return parts.join(" · ");
}

function openDetail(id) {
  const movie = state.movies.find((item) => item.id === id);
  if (!movie) return;
  const comments = state.comments[id] || [];
  els.detailContent.innerHTML = `
    <div>
      <p class="section-label">${movie.recommended ? "我推荐" : movie.mediaType}</p>
      <h2>${escapeHtml(movie.title)}</h2>
      <div class="detail-meta">
        <span>${escapeHtml(makeMeta(movie))}</span>
        ${movie.watchDate ? `<span>我看于 ${escapeHtml(movie.watchDate)}</span>` : ""}
        ${movie.note ? `<span>${escapeHtml(movie.note)}</span>` : ""}
      </div>
      <section class="comment-box">
        <p class="section-label">评论 / 粉丝推荐</p>
        <form class="comment-form" data-id="${escapeAttr(id)}">
          <textarea required placeholder="看过这部？可以写一句，也可以推荐类似的片。"></textarea>
          <button class="primary-button" type="submit">提交评论</button>
        </form>
        <div class="comment-list">
          ${comments.length ? comments.map((comment) => renderComment(id, comment)).join("") : `<p class="meta">还没有评论。</p>`}
        </div>
      </section>
    </div>
  `;
  els.detailContent.querySelector(".comment-form").addEventListener("submit", handleComment);
  els.detailContent.querySelectorAll(".delete-comment").forEach((button) => {
    button.addEventListener("click", () => deleteComment(button.dataset.movie, button.dataset.comment));
  });
  els.detailDialog.showModal();
}

function renderComment(movieId, comment) {
  return `
    <div class="comment-item">
      <p>${escapeHtml(comment.text)}</p>
      <div class="comment-actions">
        <span>${escapeHtml(comment.date)}</span>
        <button class="delete-comment" type="button" data-movie="${escapeAttr(movieId)}" data-comment="${escapeAttr(comment.id)}">删除</button>
      </div>
    </div>
  `;
}

function handleComment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.id;
  const textarea = form.querySelector("textarea");
  const text = textarea.value.trim();
  if (!text) return;
  state.comments[id] = state.comments[id] || [];
  state.comments[id].unshift({
    id: `comment-${Date.now()}`,
    text,
    date: new Date().toLocaleDateString("zh-CN"),
  });
  saveStore(STORE_KEYS.comments, state.comments);
  textarea.value = "";
  openDetail(id);
}

function deleteComment(movieId, commentId) {
  state.comments[movieId] = (state.comments[movieId] || []).filter((comment) => comment.id !== commentId);
  saveStore(STORE_KEYS.comments, state.comments);
  openDetail(movieId);
}

function openAddDialog() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  els.addForm.reset();
  els.addForm.elements.watchDate.value = `${yyyy}-${mm}-${dd}`;
  els.addDialog.showModal();
}

function handleAddMovie(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const additions = loadStore(STORE_KEYS.additions, []);
  const movie = {
    id: `added-${Date.now()}`,
    title: data.get("title").trim(),
    watchDate: data.get("watchDate"),
    mediaType: data.get("mediaType"),
    year: data.get("year").trim(),
    country: data.get("country").trim(),
    genres: [data.get("genre")],
    note: data.get("note").trim(),
    recommended: data.get("recommended") === "on",
    addedByUser: true,
  };
  additions.unshift(movie);
  saveStore(STORE_KEYS.additions, additions);
  state.movies = normalizeMovies([...state.baseMovies, ...additions]);
  els.addDialog.close();
  pickToday();
  render();
}

function loadStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

/* L1017n — worldwide game discovery.
   Only current, supplier-confirmed available categories are eligible.
   The display is an editorial popularity shortlist, never invented sales figures. */
(function () {
  "use strict";
  const globalGames = [
    /roblox|robux|روبلوكس|روبوكس/i,
    /free[\s-]*fire|فري[\s-]*فاير/i,
    /pubg|ببجي/i,
    /fortnite|فورت[\s-]*نايت/i,
    /call[\s-]*of[\s-]*duty|cod[\s-]*mobile|كول[\s-]*اوف[\s-]*ديوتي/i,
    /mobile[\s-]*legends|موبايل[\s-]*ليجند/i,
    /genshin|جينشين/i,
    /brawl[\s-]*stars|براول[\s-]*ستارز/i,
    /clash[\s-]*of[\s-]*clans|كلاش[\s-]*اوف[\s-]*كلانس/i,
    /ea[\s-]*(?:sports[\s-]*)?fc|fc[\s-]*mobile|فيفا/i,
    /minecraft|ماين[\s-]*كرافت/i,
    /valorant|فالورانت/i,
    /blood[\s-]*strike|بلود[\s-]*سترايك/i
  ];
  const rankOf = value => globalGames.findIndex(pattern => pattern.test(String(value || "")));
  const supplier = () => window.L1017nCompleteCatalog;
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  // Keep the existing homepage sorting contract for older UI components.
  function sortGames(root = document.getElementById("llCatalog")) {
    if (!root) return;
    const cards = [...root.children];
    const withRank = cards.map((card, index) => {
      const label = card.querySelector(".ll-game-section-details strong")?.textContent || "";
      const key = card.querySelector("[data-ll-game]")?.dataset.llGame || "";
      const rank = rankOf(label + " " + key);
      return {card, index, rank: rank < 0 ? 999 : rank};
    });
    withRank.sort((a,b) => a.rank - b.rank || a.index - b.index);
    if (withRank.some((entry,index) => entry.card !== cards[index])) {
      root.append(...withRank.map(entry => entry.card));
    }
  }
  window.L1017nSortGamesBySales = sortGames;

  // The supplier API returns categories with counts of *available* packages.
  // Never create extra entries to make the list reach ten.
  function availableTopTen() {
    const categories = supplier()?.categories?.();
    if (!Array.isArray(categories)) return [];
    const byGame = new Map();
    for (const item of categories) {
      const available = Number(item?.count || 0);
      const id = String(item?.category_id || "");
      if (!Number.isFinite(available) || available <= 0 || !/^[a-f0-9]{32}$/i.test(id)) continue;
      const section = String(item.section || "").toLowerCase();
      if (/card|gift|voice|audio|local/.test(section)) continue;
      const rank = rankOf([item.game, item.category_name].join(" "));
      if (rank < 0) continue;
      // Gift cards for a game are not game top-up packs.
      if (/card|gift|بطاق|كود/i.test(String(item.category_name || ""))) continue;
      const previous = byGame.get(rank);
      if (!previous || available > previous.available) {
        byGame.set(rank, {item, available, rank, id});
      }
    }
    return [...byGame.values()].sort((a,b) => a.rank - b.rank).slice(0,10);
  }

  function installStyle() {
    if (document.getElementById("l1017nTopTenStyle")) return;
    const style = node("style");
    style.id = "l1017nTopTenStyle";
    style.textContent = [
      "#l1017nTopTen{margin:22px 0 26px;direction:rtl}",
      "#l1017nTopTen[hidden]{display:none!important}",
      ".l1017-topten-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:13px;flex-wrap:wrap}",
      ".l1017-topten-head h2{font-size:clamp(20px,4.5vw,26px);margin:0;color:#f9f3ff;font-weight:850}",
      ".l1017-topten-head p{font-size:12px;color:#c8b8db;margin:5px 0 0;line-height:1.7}",
      ".l1017-topten-tag{font-size:11px;border:1px solid #a15bff85;background:#5c21a336;color:#eacfff;border-radius:100px;padding:7px 10px;white-space:nowrap}",
      ".l1017-topten-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}",
      ".l1017-topten-card{position:relative;display:flex;align-items:center;gap:10px;text-align:right;padding:11px;border:1px solid #8454c57d;border-radius:17px;min-height:98px;min-width:0;width:100%;color:#fff;background:linear-gradient(135deg,#27133e,#15101f);cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}",
      ".l1017-topten-card:hover,.l1017-topten-card:focus-visible{border-color:#c17dff;box-shadow:0 4px 22px #a445f82b;transform:translateY(-2px)}",
      ".l1017-topten-card:focus-visible{outline:2px solid #d5aaff;outline-offset:2px}",
      ".l1017-topten-art{width:59px;height:68px;flex:0 0 59px;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:linear-gradient(135deg,#482077,#160d28);color:#d7baff;font-size:24px;font-weight:900}",
      ".l1017-topten-art img{width:100%;height:100%;object-fit:cover}",
      ".l1017-topten-info{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1}",
      ".l1017-topten-info strong{font-size:13px;line-height:1.4;overflow-wrap:anywhere}",
      ".l1017-topten-info small{font-size:11px;color:#c9b7df}",
      ".l1017-topten-info em{font-style:normal;font-size:11px;color:#a3f0b4;font-weight:700}",
      ".l1017-topten-rank{position:absolute;top:-8px;left:8px;border:1px solid #cd99ff;background:#6a23c2;min-width:27px;height:27px;padding:0 4px;display:grid;place-items:center;border-radius:10px;color:white;font-size:12px;font-weight:800;box-shadow:0 3px 12px #7028c599}",
      ".l1017-topten-foot{margin:11px 1px 0!important;font-size:11px!important;color:#a99dbb!important;line-height:1.7!important}",
      ".l1017-topten-foot a{color:#d5a4ff;text-decoration:underline;text-underline-offset:2px}",
      "@media(min-width:750px){.l1017-topten-list{grid-template-columns:repeat(5,minmax(0,1fr))}}",
      "@media(max-width:370px){.l1017-topten-card{padding:8px;gap:7px}.l1017-topten-art{width:45px;height:58px;flex-basis:45px}}",
      "@media(prefers-reduced-motion:reduce){.l1017-topten-card{transition:none!important}}"
    ].join("");
    document.head.append(style);
  }

  function section() {
    const landing = document.getElementById("llLanding");
    const games = document.getElementById("llGamesSection");
    if (!landing || !games) return null;
    let panel = document.getElementById("l1017nTopTen");
    if (panel) return panel;
    installStyle();
    panel = node("section");
    panel.id = "l1017nTopTen";
    panel.hidden = true;
    panel.setAttribute("aria-labelledby","l1017nTopTenTitle");
    const header = node("div", "l1017-topten-head");
    const titleBlock = node("div");
    const title = node("h2","", "توب 10 عالميًا");
    title.id = "l1017nTopTenTitle";
    titleBlock.append(title, node("p","", "ألعاب رائجة عالميًا، ومن الباقات المتوفرة في متجرنا فقط"));
    header.append(titleBlock, node("span","l1017-topten-tag","المتوفر فقط"));
    const list = node("div","l1017-topten-list");
    list.id = "l1017nTopTenList";
    const foot = node("p","l1017-topten-foot","ترتيب استرشادي حسب انتشار الألعاب وإيراداتها عالميًا؛ لا يمثل أرقام مبيعات باقات L1017n. ");
    const source = node("a","", "مؤشرات السوق");
    source.href = "https://sensortower.com/blog/top-10-worldwide-mobile-games-by-revenue-and-downloads-in-september-2026";
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    foot.append(source);
    panel.append(header,list,foot);
    games.before(panel);
    return panel;
  }

  function render() {
    const panel = section();
    if (!panel) return;
    const chosen = document.querySelector("#llCategories [data-ll-category].selected")?.dataset.llCategory || "all";
    const searching = !!document.getElementById("llSearch")?.value.trim();
    const top = availableTopTen();
    panel.hidden = !top.length || searching || (chosen !== "all" && chosen !== "games") || document.body.dataset.checkoutWallet === "almadar";
    if (panel.hidden) return;
    const list = document.getElementById("l1017nTopTenList");
    const key = top.map(x => x.id + ":" + x.available).join("|");
    if (list.dataset.key === key) return;
    list.dataset.key = key;
    list.replaceChildren();
    top.forEach((entry,index) => {
      const item = entry.item;
      const button = node("button","l1017-topten-card");
      button.type = "button";
      button.setAttribute("aria-label","عرض باقات " + item.category_name + " المتوفرة");
      const art = node("span","l1017-topten-art");
      const src = supplier()?.imageFor?.(item);
      if (src) {
        const photo = node("img");
        photo.src = src;
        photo.alt = "";
        photo.loading = "lazy";
        photo.onerror = () => photo.remove();
        art.append(photo);
      } else {
        art.textContent = "L";
      }
      const info = node("span","l1017-topten-info");
      info.append(
        node("strong","",item.category_name),
        node("small","",entry.available + " باقة متوفرة"),
        node("em","","عرض الباقات ←")
      );
      button.append(art,info,node("span","l1017-topten-rank",String(index+1)));
      button.onclick = () => supplier()?.open?.(entry.id);
      list.append(button);
    });
  }

  const schedule = () => requestAnimationFrame(render);
  window.addEventListener("l1017n:catalog-shell-ready",render);
  window.addEventListener("l1017n:catalog-updated",() => { sortGames(); render(); });
  window.addEventListener("l1017n:checkout-wallet-changed",render);
  document.addEventListener("input",event => { if(event.target?.id==="llSearch") schedule(); });
  document.addEventListener("click",event => { if(event.target?.closest?.("[data-ll-category]")) schedule(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",render,{once:true});
  else render();
})();

(function () {
    'use strict';

    const RESULT_ID = 'dk-tribe-visible-attacks-result';
    const CACHE_PREFIX = 'dk_visible_attacks_cache_v2_';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function normalize(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeLower(text) {
        return normalize(text).toLowerCase();
    }

    function absUrl(url) {
        if (!url) return null;
        if (/^https?:\/\//i.test(url)) return url;
        return location.origin + url;
    }

    function uniqueBy(arr, keyFn) {
        const out = [];
        const seen = new Set();
        for (const item of arr) {
            const key = keyFn(item);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(item);
        }
        return out;
    }

    function getCoordsFromText(text) {
        const matches = [...String(text || '').matchAll(/\b(\d{1,3}\|\d{1,3})\b/g)];
        return matches.map(m => m[1]);
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function fetchDoc(url) {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
            throw new Error(`Nepodarilo sa nacitat: ${url}`);
        }
        const html = await res.text();
        return new DOMParser().parseFromString(html, 'text/html');
    }

    function isTribePage() {
        return location.href.includes('screen=info_ally') && location.href.includes('id=');
    }

    function findMembersTable(doc) {
        const h3s = [...doc.querySelectorAll('h3')];
        const header = h3s.find(h => normalizeLower(h.textContent).includes('členovia kmeňa'));

        if (header) {
            let next = header.nextElementSibling;
            while (next) {
                if (next.matches && next.matches('table')) return next;
                next = next.nextElementSibling;
            }
        }

        const tables = [...doc.querySelectorAll('table.vis')];
        return tables.find(t => {
            const txt = normalizeLower(t.textContent);
            return txt.includes('meno') && txt.includes('bodov') && txt.includes('dediny');
        }) || null;
    }

    function extractPlayersFromTribeDoc(doc) {
        const table = findMembersTable(doc);
        if (!table) {
            throw new Error('Nepodarilo sa najst tabulku clenov kmena.');
        }

        const players = [...table.querySelectorAll('a[href*="screen=info_player"][href*="id="]')]
            .map(a => ({
                name: normalize(a.textContent),
                url: absUrl(a.getAttribute('href'))
            }))
            .filter(p => p.name && p.url);

        return uniqueBy(players, p => `${p.name}|${p.url}`);
    }

    function extractVillageIdFromHref(href) {
        if (!href) return null;
        const match = href.match(/[?&]id=(\d+)/);
        return match ? match[1] : null;
    }

    function buildVillageInfoUrl(villageId) {
        const villageParam = new URL(location.href).searchParams.get('village') || '';
        return `${location.origin}/game.php?village=${encodeURIComponent(villageParam)}&screen=info_village&id=${encodeURIComponent(villageId)}`;
    }

    function extractVillagesFromPlayerDoc(doc, playerName) {
        const villages = [];

        const villageLinks = [...doc.querySelectorAll('a[href*="screen=info_village"][href*="id="]')];
        for (const a of villageLinks) {
            const href = a.getAttribute('href');
            const villageId = extractVillageIdFromHref(href);
            const coords = getCoordsFromText(a.textContent || '').pop() || null;

            if (villageId) {
                villages.push({
                    villageId,
                    coords,
                    url: absUrl(href),
                    source: 'info_village_link',
                    playerName
                });
            }
        }

        if (!villages.length) {
            const rows = [...doc.querySelectorAll('#content_value tr')];
            for (const row of rows) {
                const text = normalize(row.textContent);
                const coords = getCoordsFromText(text);
                if (!coords.length) continue;

                const link = row.querySelector('a[href*="screen=info_village"][href*="id="]');
                if (link) {
                    const villageId = extractVillageIdFromHref(link.getAttribute('href'));
                    if (villageId) {
                        villages.push({
                            villageId,
                            coords: coords[0] || null,
                            url: absUrl(link.getAttribute('href')),
                            source: 'row_link',
                            playerName
                        });
                    }
                }
            }
        }

        if (!villages.length) {
            const allText = [...doc.querySelectorAll('#content_value table, #content_value tr, #content_value td')];
            const foundCoords = new Set();
            for (const el of allText) {
                getCoordsFromText(el.textContent).forEach(c => foundCoords.add(c));
            }
            for (const c of foundCoords) {
                villages.push({
                    villageId: null,
                    coords: c,
                    url: null,
                    source: 'coords_only',
                    playerName
                });
            }
        }

        return uniqueBy(villages, v => `${v.villageId || 'x'}|${v.coords || 'y'}`);
    }

    async function extractVillagesFromPlayer(player) {
        const doc = await fetchDoc(player.url);
        return extractVillagesFromPlayerDoc(doc, player.name);
    }

    function getVillageSummaryFromVillageDoc(doc) {
        const result = {
            villageName: null,
            coords: null,
            playerName: null,
            tribeName: null
        };

        const content = doc.querySelector('#content_value') || doc;

        const h2 = content.querySelector('h2');
        if (h2) result.villageName = normalize(h2.textContent);

        const rows = [...content.querySelectorAll('table.vis tr')];
        for (const row of rows) {
            const tds = row.querySelectorAll('td');
            if (tds.length < 2) continue;

            const label = normalizeLower(tds[0].textContent);
            const value = normalize(tds[1].textContent);

            if (label.includes('súradnice') || label.includes('suradnice')) {
                result.coords = value;
            } else if (label.includes('hráč') || label.includes('hrac')) {
                result.playerName = value;
            } else if (label.includes('kmeň') || label.includes('kmen')) {
                result.tribeName = value;
            }
        }

        return result;
    }

    function countVisibleAttacksOnVillageDoc(doc) {
        const container = doc.querySelector('#commands_outgoings.commands-container');
        if (!container) {
            return {
                total: 0,
                matchedRows: [],
                foundContainer: false
            };
        }

        const rows = [...container.querySelectorAll('tr.command-row')];

        const matchedRows = rows.filter(row => {
            const hover = row.querySelector('.command_hover_details[data-command-type="attack"]');
            if (hover) return true;

            const txt = normalizeLower(row.textContent);
            return txt.includes('útok') || txt.includes('utok');
        });

        return {
            total: matchedRows.length,
            matchedRows,
            foundContainer: true
        };
    }

    async function inspectVillage(village, index, total, progressBox) {
        if (!village.url && village.villageId) {
            village.url = buildVillageInfoUrl(village.villageId);
        }

        if (!village.url) {
            return {
                village,
                totalAttacks: 0,
                foundContainer: false,
                skipped: true,
                reason: 'Dedina nema info_village odkaz.'
            };
        }

        if (progressBox) {
            progressBox.innerHTML = `<b>Spracovávam dedinu ${index}/${total}</b>`;
        }

        try {
            const doc = await fetchDoc(village.url);
            const summary = getVillageSummaryFromVillageDoc(doc);
            const count = countVisibleAttacksOnVillageDoc(doc);

            return {
                village: {
                    ...village,
                    coords: village.coords || summary.coords,
                    villageName: summary.villageName || null,
                    playerName: village.playerName || summary.playerName || null,
                    tribeName: summary.tribeName || null
                },
                totalAttacks: count.total,
                foundContainer: count.foundContainer,
                skipped: false
            };
        } catch (e) {
            return {
                village,
                totalAttacks: 0,
                foundContainer: false,
                skipped: true,
                reason: e.message
            };
        }
    }

    function getCacheKey() {
        const allyId = new URL(location.href).searchParams.get('id') || 'unknown';
        return CACHE_PREFIX + allyId;
    }

    function saveCache(data) {
        try {
            localStorage.setItem(getCacheKey(), JSON.stringify(data));
        } catch {}
    }

    function loadCache() {
        try {
            const raw = localStorage.getItem(getCacheKey());
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function clearCache() {
        try {
            localStorage.removeItem(getCacheKey());
        } catch {}
    }

    function getTribeName() {
        return normalize(document.querySelector('#content_value h2')?.textContent || 'Neznámy kmeň');
    }

    function getOrCreateResultBox() {
        let box = document.getElementById(RESULT_ID);

        if (!box) {
            box = document.createElement('div');
            box.id = RESULT_ID;
            box.style.position = 'fixed';
            box.style.top = '80px';
            box.style.right = '20px';
            box.style.zIndex = '999999';
            box.style.maxWidth = '420px';
            box.style.maxHeight = '70vh';
            box.style.overflow = 'auto';
            box.style.background = '#f4e4bc';
            box.style.border = '2px solid #6b4f2a';
            box.style.borderRadius = '6px';
            box.style.padding = '12px';
            box.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
            box.style.color = '#2b1a0d';
            box.style.fontSize = '13px';
            document.body.appendChild(box);
        }

        return box;
    }

    function renderTopVillages(results) {
        const top = results
            .filter(r => r.totalAttacks > 0)
            .sort((a, b) => b.totalAttacks - a.totalAttacks)
            .slice(0, 15);

        if (!top.length) return 'Žiadne';

        return top.map(r => {
            const name = escapeHtml(r.village.villageName || 'Dedina');
            const coords = escapeHtml(r.village.coords || '?');
            const player = escapeHtml(r.village.playerName || '?');
            return `<div style="margin-bottom:6px;"><b>${name}</b> (${coords})<br><span style="opacity:.85">${player}</span> — <b>${r.totalAttacks}</b></div>`;
        }).join('');
    }

    async function runScript() {
        if (!isTribePage()) {
            alert('Tento script spúšťaj na stránke kmeňa: screen=info_ally&id=...');
            return;
        }

        const box = getOrCreateResultBox();
        box.innerHTML = '<b>Spúšťam script...</b>';

        try {
            const tribeName = getTribeName();

            const useCache = confirm(
                `Kmeň: ${tribeName}\n\n` +
                `OK = použiť cache dedín, ak existuje\n` +
                `Zrušiť = načítať všetko nanovo`
            );

            if (!useCache) clearCache();

            let players = [];
            let villages = [];
            let usedCache = false;

            const cached = useCache ? loadCache() : null;

            if (cached && Array.isArray(cached.players) && Array.isArray(cached.villages)) {
                players = cached.players;
                villages = cached.villages;
                usedCache = true;
            } else {
                box.innerHTML = '<b>Načítavam hráčov...</b>';

                players = extractPlayersFromTribeDoc(document);

                if (!players.length) {
                    throw new Error('Nenašli sa žiadni hráči v kmeni.');
                }

                villages = [];

                for (let i = 0; i < players.length; i++) {
                    const player = players[i];
                    box.innerHTML = `<b>Načítavam hráča ${i + 1}/${players.length}</b><br>${escapeHtml(player.name)}`;

                    try {
                        const playerVillages = await extractVillagesFromPlayer(player);
                        villages.push(...playerVillages);
                    } catch (e) {
                        console.warn(`Chyba pri hráčovi ${player.name}:`, e);
                    }

                    await sleep(200);
                }

                villages = uniqueBy(
                    villages.filter(v => v.villageId || v.coords),
                    v => `${v.villageId || 'x'}|${v.coords || 'y'}`
                );

                saveCache({
                    savedAt: Date.now(),
                    tribeName,
                    players,
                    villages
                });
            }

            if (!villages.length) {
                throw new Error('Nepodarilo sa nájsť žiadne dediny hráčov.');
            }

            const villagesWithId = villages.filter(v => v.villageId || v.url);
            const villagesWithoutId = villages.filter(v => !v.villageId && !v.url);

            if (!villagesWithId.length) {
                throw new Error('Na profiloch hráčov som nenašiel odkazy na info_village.');
            }

            const results = [];

            for (let i = 0; i < villagesWithId.length; i++) {
                const result = await inspectVillage(villagesWithId[i], i + 1, villagesWithId.length, box);
                results.push(result);
                await sleep(150);
            }

            const totalAttacks = results.reduce((sum, r) => sum + r.totalAttacks, 0);
            const villagesWithAttacks = results.filter(r => r.totalAttacks > 0).length;
            const skipped = results.filter(r => r.skipped).length;
            const noContainer = results.filter(r => !r.skipped && !r.foundContainer).length;

            box.innerHTML = `
                <div style="font-size:15px; font-weight:bold; margin-bottom:8px;">
                    Výsledok
                </div>
                <div><b>Kmeň:</b> ${escapeHtml(tribeName)}</div>
                <div><b>Hráči:</b> ${players.length}</div>
                <div><b>Dediny nájdené:</b> ${villages.length}</div>
                <div><b>Dediny otvorené:</b> ${villagesWithId.length}</div>
                <div><b>Dediny bez ID:</b> ${villagesWithoutId.length}</div>
                <div><b>Dediny s útokmi:</b> ${villagesWithAttacks}</div>
                <div><b>Spolu viditeľné útoky:</b> ${totalAttacks}</div>
                <div><b>Cache:</b> ${usedCache ? 'áno' : 'nie'}</div>
                <div><b>Preskočené:</b> ${skipped}</div>
                <div><b>Bez commands_outgoings:</b> ${noContainer}</div>
                <hr style="margin:8px 0;">
                <div><b>Najviac napádané dediny:</b></div>
                <div style="margin-top:6px;">
                    ${renderTopVillages(results)}
                </div>
            `;

            console.log('DK visible attacks result', {
                tribeName,
                playersCount: players.length,
                villagesFound: villages.length,
                villagesOpened: villagesWithId.length,
                villagesWithoutId: villagesWithoutId.length,
                totalAttacks,
                villagesWithAttacks,
                usedCache,
                skipped,
                noContainer,
                results
            });

            alert(
                `Hotovo.\n\n` +
                `Kmeň: ${tribeName}\n` +
                `Hráči: ${players.length}\n` +
                `Dediny nájdené: ${villages.length}\n` +
                `Dediny otvorené: ${villagesWithId.length}\n` +
                `Viditeľné útoky spolu: ${totalAttacks}`
            );
        } catch (e) {
            console.error(e);
            box.innerHTML = `<b>Chyba:</b><br>${escapeHtml(e.message)}`;
            alert(`Chyba: ${e.message}`);
        }
    }

    if (window.__dkVisibleAttacksRunning) {
        alert('Script už beží.');
        return;
    }
    window.__dkVisibleAttacksRunning = true;

    runScript().finally(() => {
        window.__dkVisibleAttacksRunning = false;
    });
})();
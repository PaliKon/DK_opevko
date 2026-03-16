/*
 * Script Name: Clear Barbarian Walls
 * Version: v1.6.1-mod
 * Last Updated: 2026-03-16
 * Author: RedAlert
 * Author URL: https://twscripts.dev/
 * Author Contact: redalert_tw (Discord)
 * Mod: Custom source village + troop template settings
 */

/* Copyright (c) RedAlert
By uploading a user-generated mod (script) for use with Tribal Wars, you grant InnoGames a perpetual, irrevocable, worldwide, royalty-free, non-exclusive license to use, reproduce, distribute, publicly display, modify, and create derivative works of the mod. This license permits InnoGames to incorporate the mod into any aspect of the game and its related services, including promotional and commercial endeavors, without any requirement for compensation or attribution to you. InnoGames is entitled but not obligated to name you when exercising its rights. You represent and warrant that you have the legal right to grant this license and that the mod does not infringe upon any third-party rights. You are - with the exception of claims of infringement by third parties â€“ not liable for any usage of the mod by InnoGames. German law applies.
*/

var scriptData = {
    name: 'Clear Barbarian Walls',
    version: 'v1.6.1-mod',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink:
        'https://forum.tribalwars.net/index.php?threads/clear-barbarian-walls.286971/',
};

// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;

// Globals
var ALLOWED_GAME_SCREENS = ['map'];
var COORDS_REGEX = /[0-9]{1,3}\|[0-9]{1,3}/g;

if (typeof TWMap === 'undefined') TWMap = {};
if ('TWMap' in window) mapOverlay = TWMap;

// Data Store Config
var STORAGE_KEY = 'RA_CBW_STORE';
var DEFAULT_STATE = {
    MAX_BARBARIANS: 100,
    MAX_FA_PAGES_TO_FETCH: 20,
    AXE: 10,
    RAM: 8,
    CATAPULT: 6,
    SPY: 1,
};

// Translations
var translations = {
    en_DK: {
        'Clear Barbarian Walls': 'Clear Barbarian Walls',
        Help: 'Help',
        'This script requires PA and FA to be active!':
            'This script requires PA and FA to be active!',
        'Redirecting...': 'Redirecting...',
        'Fetching FA pages...': 'Fetching FA pages...',
        'Finished fetching FA pages!': 'Finished fetching FA pages!',
        Fetching: 'Fetching',
        'No barbarian villages found fitting the criteria!':
            'No barbarian villages found fitting the criteria!',
        Type: 'Type',
        Barbarian: 'Barbarian',
        From: 'From',
        Report: 'Report',
        Distance: 'Distance',
        Wall: 'Wall',
        'Last Attack Time': 'Last Attack Time',
        Actions: 'Actions',
        Attack: 'Attack',
        'barbarian villages where found': 'barbarian villages where found',
        'Showing the first': 'Showing the first',
        'barbarian villages.': 'barbarian villages.',
        Settings: 'Settings',
        'Save Settings': 'Save Settings',
        'Maximum villages to show on the table':
            'Maximum villages to show on the table',
        'Maximum FA Pages to fetch': 'Maximum FA Pages to fetch',
        Axe: 'Axe',
        Ram: 'Ram',
        Catapult: 'Catapult',
        Spy: 'Spy',
        'Settings saved!': 'Settings saved!',
    },
};

// Init Debug
initDebug();

// Initialize script logic
async function initClearBarbarianWalls(store) {
    const {
        MAX_BARBARIANS,
        MAX_FA_PAGES_TO_FETCH,
    } = store;

    const ownVillages = await fetchAllPlayerVillagesByGroup(game_data.group_id);
    const troopCounts = await fetchTroopsForCurrentGroup(game_data.group_id);
    const faURLs = await fetchFAPages(MAX_FA_PAGES_TO_FETCH);

    if (!faURLs || !faURLs.length) {
        UI.ErrorMessage('Error fetching FA pages!');
        return;
    }

    startProgressBar(faURLs.length);
    UI.SuccessMessage(tt('Fetching FA pages...'));

    const faPages = [];
    jQuery.fetchAll(
        faURLs,
        function (index, data) {
            updateProgressBar(index, faURLs.length);
            const { plunder_list } = data;
            faPages.push(...plunder_list);
        },
        function () {
            const faTableRows = getFATableRows(faPages);
            let barbarians = getFABarbarians(faTableRows);

            barbarians = barbarians.map((barbarian) => {
                const unitsToSend = calculateUnitsToSend(store);

                const sourceVillage = getNearestSourceVillage(
                    barbarian.coord,
                    ownVillages,
                    troopCounts,
                    unitsToSend
                );

                return {
                    ...barbarian,
                    sourceVillageId: sourceVillage ? sourceVillage.id : null,
                    sourceVillageCoord: sourceVillage ? sourceVillage.coord : '-',
                    sourceVillageName: sourceVillage ? sourceVillage.name : '-',
                    sourceVillageDistance: sourceVillage
                        ? parseFloat(sourceVillage.distance).toFixed(2)
                        : '-',
                };
            });

            const content = prepareContent(barbarians, MAX_BARBARIANS);
            renderUI(content);
            jQuery('#barbVillagesCount').text(barbarians.length);

            updateMap(barbarians);
            showSettingsPanel(store);
        },
        function (error) {
            UI.ErrorMessage('Error fetching FA pages!');
            console.error(`${scriptInfo()} Error:`, error);
        }
    );
}

// Update map to include barbarians
function updateMap(barbarians) {
    const barbCoords = barbarians.map((barbarian) => barbarian.coord);

    if (!mapOverlay || !mapOverlay.mapHandler) return;

    if (!mapOverlay.mapHandler._spawnSector) {
        mapOverlay.mapHandler._spawnSector = mapOverlay.mapHandler.spawnSector;
    }

    TWMap.mapHandler.spawnSector = function (data, sector) {
        mapOverlay.mapHandler._spawnSector(data, sector);

        var beginX = sector.x - data.x;
        var endX = beginX + mapOverlay.mapSubSectorSize;
        var beginY = sector.y - data.y;
        var endY = beginY + mapOverlay.mapSubSectorSize;

        for (var x in data.tiles) {
            x = parseInt(x, 10);
            if (x < beginX || x >= endX) continue;

            for (var y in data.tiles[x]) {
                y = parseInt(y, 10);
                if (y < beginY || y >= endY) continue;

                var xCoord = data.x + x;
                var yCoord = data.y + y;
                var v = mapOverlay.villages[xCoord * 1000 + yCoord];

                if (v) {
                    var vXY = '' + v.xy;
                    var vCoords = vXY.slice(0, 3) + '|' + vXY.slice(3, 6);

                    if (barbCoords.includes(vCoords)) {
                        const currentBarbarian = barbarians.find(
                            (obj) => obj.villageId == v.id
                        );

                        if (!currentBarbarian) continue;

                        const eleDIV = $('<div></div>')
                            .css({
                                border: '1px coral solid',
                                position: 'absolute',
                                backgroundColor: '#000',
                                color: '#fff',
                                width: '30px',
                                height: '15px',
                                marginTop: '20px',
                                marginLeft: '10px',
                                display: 'block',
                                zIndex: '10',
                                fontWeight: 'normal',
                                textAlign: 'center',
                            })
                            .attr('id', 'dsm' + v.id)
                            .html(currentBarbarian.wall);

                        sector.appendElement(
                            eleDIV[0],
                            data.x + x - sector.x,
                            data.y + y - sector.y
                        );
                    }
                }
            }
        }
    };

    mapOverlay.reload();
}

// Prepare content
function prepareContent(villages, maxBarbsToShow) {
    if (villages.length) {
        const barbsTable = buildBarbsTable(villages, maxBarbsToShow);

        return `
			<div>
				<p>
					<b><span id="barbVillagesCount"></span> ${tt(
                        'barbarian villages where found'
                    )}</b><br>
					<em>${tt('Showing the first')} ${maxBarbsToShow} ${tt(
            'barbarian villages.'
        )}</em>
				</p>
			</div>
			<div class="ra-table-container">
				${barbsTable}
			</div>
		`;
    } else {
        return `<b>${tt(
            'No barbarian villages found fitting the criteria!'
        )}</b>`;
    }
}

// Render UI
function renderUI(body) {
    const content = `
        <div class="ra-clear-barbs-walls" id="raClearBarbWalls">
			<div class="ra-clear-barbs-walls-header">
				<h3>${tt(scriptData.name)}</h3>
				<a href="javascript:void(0);" id="showSettingsPanel" class="btn-show-settings">
					<span class="icon header settings"></span>
				</a>
			</div>
            <div class="ra-clear-barbs-walls-body">
                ${body}
            </div>
			<div class="ra-clear-barbs-walls-footer">
				<small>
					<strong>
						${tt(scriptData.name)} ${scriptData.version}
					</strong> -
					<a href="${scriptData.authorUrl}" target="_blank" rel="noreferrer noopener">
						${scriptData.author}
					</a> -
					<a href="${scriptData.helpLink}" target="_blank" rel="noreferrer noopener">
						${tt('Help')}
					</a>
				</small>
			</div>
        </div>
        <style>
            .ra-clear-barbs-walls { position: relative; display: block; width: 100%; height: auto; clear: both; margin: 10px 0 15px; border: 1px solid #603000; box-sizing: border-box; background: #f4e4bc; }
            .ra-clear-barbs-walls * { box-sizing: border-box; }
			.ra-clear-barbs-walls > div { padding: 10px; }
            .ra-clear-barbs-walls .btn-confirm-yes { padding: 3px; }
			.ra-clear-barbs-walls-header { display: flex; align-items: center; justify-content: space-between; background-color: #c1a264 !important; background-image: url(/graphic/screen/tableheader_bg3.png); background-repeat: repeat-x; }
			.ra-clear-barbs-walls-header h3 { margin: 0; padding: 0; line-height: 1; }
			.ra-clear-barbs-walls-body p { font-size: 14px; }
            .ra-clear-barbs-walls-body label { display: block; font-weight: 600; margin-bottom: 6px; }
			.ra-table-container { overflow-y: auto; overflow-x: auto; height: auto; max-height: 312px; border: 1px solid #bc6e1f; }
			.ra-table th { font-size: 14px; white-space: nowrap; }
			.ra-table th, .ra-table td { padding: 3px; text-align: center; white-space: nowrap; }
            .ra-table td a { word-break: break-all; }
			.ra-table a:focus { color: blue; }
			.ra-table a.btn:focus { color: #fff; }
			.ra-table tr:nth-of-type(2n) td { background-color: #f0e2be }
			.ra-table tr:nth-of-type(2n+1) td { background-color: #fff5da; }
			.ra-popup-content { width: 420px; }
			.ra-popup-content * { box-sizing: border-box; }
			.ra-popup-content input[type="text"] { padding: 3px; width: 100%; }
            .ra-mb15 { margin-bottom: 15px; }
			.already-sent-command { opacity: 0.6; }
        </style>
    `;

    if (jQuery('#raClearBarbWalls').length < 1) {
        jQuery('#contentContainer').prepend(content);
    } else {
        jQuery('.ra-clear-barbs-walls-body').html(body);
    }
}

// Settings
function showSettingsPanel(store) {
    jQuery('#showSettingsPanel').off('click').on('click', function (e) {
        e.preventDefault();

        const {
            MAX_BARBARIANS,
            MAX_FA_PAGES_TO_FETCH,
            AXE,
            RAM,
            CATAPULT,
            SPY,
        } = store;

        const content = `
			<div class="ra-popup-content">
				<div class="ra-popup-header">
					<h3>${tt('Settings')}</h3>
				</div>
				<div class="ra-popup-body ra-mb15">
					<table class="ra-settings-table" width="100%">
						<tbody>
							<tr>
								<td width="70%">
									<label for="maxBarbVillages">
										${tt('Maximum villages to show on the table')}
									</label>
								</td>
								<td width="30%">
									<input type="text" name="max_barb_villages" id="maxBarbVillages" value="${MAX_BARBARIANS}" />
								</td>
							</tr>
							<tr>
								<td width="70%">
									<label for="maxFApages">
										${tt('Maximum FA Pages to fetch')}
									</label>
								</td>
								<td width="30%">
									<input type="text" name="max_fa_pages" id="maxFApages" value="${MAX_FA_PAGES_TO_FETCH}" />
								</td>
							</tr>
							<tr>
								<td width="70%">
									<label for="unitAxe">${tt('Axe')}</label>
								</td>
								<td width="30%">
									<input type="text" id="unitAxe" value="${AXE}" />
								</td>
							</tr>
							<tr>
								<td width="70%">
									<label for="unitRam">${tt('Ram')}</label>
								</td>
								<td width="30%">
									<input type="text" id="unitRam" value="${RAM}" />
								</td>
							</tr>
							<tr>
								<td width="70%">
									<label for="unitCatapult">${tt('Catapult')}</label>
								</td>
								<td width="30%">
									<input type="text" id="unitCatapult" value="${CATAPULT}" />
								</td>
							</tr>
							<tr>
								<td width="70%">
									<label for="unitSpy">${tt('Spy')}</label>
								</td>
								<td width="30%">
									<input type="text" id="unitSpy" value="${SPY}" />
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="ra-popup-footer">
					<a href="javascript:void(0);" id="saveSettingsBtn" class="btn btn-confirm-yes">
						${tt('Save Settings')}
					</a>
				</div>
			</div>
		`;

        Dialog.show('SettingsPanel', content);
        saveSettings();
    });
}

function saveSettings() {
    jQuery('#saveSettingsBtn').off('click').on('click', function (e) {
        e.preventDefault();

        const data = {
            MAX_BARBARIANS: sanitizeNumber(jQuery('#maxBarbVillages').val(), 100),
            MAX_FA_PAGES_TO_FETCH: sanitizeNumber(jQuery('#maxFApages').val(), 20),
            AXE: sanitizeNumber(jQuery('#unitAxe').val(), 10),
            RAM: sanitizeNumber(jQuery('#unitRam').val(), 8),
            CATAPULT: sanitizeNumber(jQuery('#unitCatapult').val(), 6),
            SPY: sanitizeNumber(jQuery('#unitSpy').val(), 1),
        };

        writeStorage(data, readStorage(DEFAULT_STATE));
        UI.SuccessMessage(tt('Settings saved!'), 1000);
        initClearBarbarianWalls(readStorage(DEFAULT_STATE));
    });
}

// Build barbs table
function buildBarbsTable(villages, maxBarbsToShow) {
    villages = villages.slice(0, maxBarbsToShow);

    let barbsTable = `
		<table class="ra-table" width="100%">
			<thead>
				<tr>
					<th>#</th>
					<th>${tt('Type')}</th>
					<th>${tt('Barbarian')}</th>
					<th>${tt('From')}</th>
					<th>${tt('Report')}</th>
					<th>${tt('Distance')}</th>
					<th>${tt('Wall')}</th>
					<th>${tt('Last Attack Time')}</th>
					<th>${tt('Actions')}</th>
				</tr>
			</thead>
			<tbody>
	`;

    villages.forEach((village, index) => {
        index++;

        const {
            villageId,
            coord,
            wall,
            reportId,
            reportTime,
            type,
            sourceVillageId,
            sourceVillageCoord,
            sourceVillageDistance,
            unitsToSend,
        } = village;

        const villageUrl = `${game_data.link_base_pure}info_village&id=${villageId}`;
        const reportUrl = `${game_data.link_base_pure}report&mode=all&view=${reportId}`;

        let commandUrl = 'javascript:void(0);';
        if (sourceVillageId) {
            const sitterParam =
                game_data.player.sitter > 0 ? `&t=${game_data.player.id}` : '';

            commandUrl =
                `${game_data.link_base_pure}place` +
                `${sitterParam}` +
                `&village=${sourceVillageId}` +
                `&target=${villageId}` +
                `${unitsToSend}` +
                `&wall=${wall}`;
        }

        barbsTable += `
			<tr>
				<td>${index}</td>
				<td><img src="${type}"></td>
				<td>
					<a href="${villageUrl}" target="_blank" rel="noopener noreferrer">
						${coord}
					</a>
				</td>
				<td>
					${
                        sourceVillageId
                            ? `<a href="${game_data.link_base_pure}info_village&id=${sourceVillageId}" target="_blank" rel="noopener noreferrer">${sourceVillageCoord}</a>`
                            : '-'
                    }
				</td>
				<td>
					<a href="${reportUrl}" target="_blank" rel="noopener noreferrer">
						<span class="icon header new_report"></span>
					</a>
				</td>
				<td>${sourceVillageDistance ?? '-'}</td>
				<td>${wall !== '?' ? wall : '<b style="color:red;">?</b>'}</td>
				<td>${reportTime}</td>
				<td>
					${
                        sourceVillageId
                            ? `<a href="${commandUrl}" onClick="highlightOpenedCommands(this);" class="ra-clear-barb-wall-btn btn" target="_blank" rel="noopener noreferrer">${tt(
                                  'Attack'
                              )}</a>`
                            : '-'
                    }
				</td>
			</tr>
		`;
    });

    barbsTable += `
			</tbody>
		</table>
	`;

    return barbsTable;
}

function highlightOpenedCommands(element) {
    element.classList.add('btn-confirm-yes');
    element.classList.add('btn-already-sent');
    element.parentElement.parentElement.classList.add('already-sent-command');
}

// Fetch villages in group
async function fetchAllPlayerVillagesByGroup(groupId) {
    try {
        let fetchVillagesUrl = '';
        if (game_data.player.sitter > 0) {
            fetchVillagesUrl =
                game_data.link_base_pure +
                `groups&ajax=load_villages_from_group&t=${game_data.player.id}`;
        } else {
            fetchVillagesUrl =
                game_data.link_base_pure + 'groups&ajax=load_villages_from_group';
        }

        const villagesByGroup = await jQuery
            .post({
                url: fetchVillagesUrl,
                data: { group_id: groupId },
                dataType: 'json',
                headers: { 'TribalWars-Ajax': 1 },
            })
            .then(({ response }) => {
                const parser = new DOMParser();
                const htmlDoc = parser.parseFromString(response.html, 'text/html');
                const tableRows = jQuery(htmlDoc)
                    .find('#group_table > tbody > tr')
                    .not(':eq(0)');

                let villagesList = [];

                tableRows.each(function () {
                    const villageLink = jQuery(this).find('td:eq(0) a');
                    const villageId =
                        villageLink.attr('data-village-id') ||
                        (villageLink.attr('href') || '').match(/\d+/)?.[0];

                    const villageName = jQuery(this).find('td:eq(0)').text().trim();
                    const villageCoords = jQuery(this).find('td:eq(1)').text().trim();

                    if (villageId && villageCoords.match(COORDS_REGEX)) {
                        villagesList.push({
                            id: parseInt(villageId, 10),
                            name: villageName,
                            coords: villageCoords,
                        });
                    }
                });

                return villagesList;
            });

        return villagesByGroup || [];
    } catch (error) {
        UI.ErrorMessage('Error fetching player villages by group!');
        console.error(`${scriptInfo()} Error:`, error);
        return [];
    }
}

// Fetch troop counts
async function fetchTroopsForCurrentGroup(groupId) {
    const troopsForGroup = await jQuery
        .get(
            game_data.link_base_pure +
                `overview_villages&mode=combined&group=${groupId}&page=-1`
        )
        .then((response) => {
            const htmlDoc = jQuery.parseHTML(response);
            const homeTroops = [];
            const combinedTableRows = jQuery(htmlDoc).find(
                '#combined_table tr.nowrap'
            );
            const combinedTableHead = jQuery(htmlDoc).find(
                '#combined_table tr:eq(0) th'
            );

            const combinedTableHeader = [];

            jQuery(combinedTableHead).each(function () {
                const thImage = jQuery(this).find('img').attr('src');
                if (thImage) {
                    let thImageFilename = thImage.split('/').pop();
                    thImageFilename = thImageFilename.replace('.webp', '');
                    combinedTableHeader.push(thImageFilename);
                } else {
                    combinedTableHeader.push(null);
                }
            });

            combinedTableRows.each(function () {
                let rowTroops = {};

                combinedTableHeader.forEach((tableHeader, index) => {
                    if (tableHeader && tableHeader.includes('unit_')) {
                        const villageId = jQuery(this)
                            .find('td:eq(1) span.quickedit-vn')
                            .attr('data-id');

                        const unitType = tableHeader.replace('unit_', '');

                        rowTroops = {
                            ...rowTroops,
                            villageId: parseInt(villageId, 10),
                            [unitType]:
                                parseInt(
                                    jQuery(this)
                                        .find(`td:eq(${index})`)
                                        .text()
                                        .replace(/\./g, '')
                                        .trim(),
                                    10
                                ) || 0,
                        };
                    }
                });

                if (rowTroops.villageId) {
                    homeTroops.push(rowTroops);
                }
            });

            return homeTroops;
        })
        .catch((error) => {
            UI.ErrorMessage('Error fetching troop counts!');
            console.error(`${scriptInfo()} Error:`, error);
            return [];
        });

    return troopsForGroup;
}

// Helper distance
function calculateDistance(from, to) {
    const [x1, y1] = from.split('|').map(Number);
    const [x2, y2] = to.split('|').map(Number);
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
}

function parseUnitsString(unitsString) {
    const params = new URLSearchParams(unitsString.replace(/^&/, ''));

    return {
        axe: parseInt(params.get('axe') || 0, 10),
        ram: parseInt(params.get('ram') || 0, 10),
        catapult: parseInt(params.get('catapult') || 0, 10),
        spy: parseInt(params.get('spy') || 0, 10),
    };
}

function getNearestSourceVillage(targetCoord, ownVillages, troopCounts, unitsToSend) {
    if (!ownVillages || !ownVillages.length) return null;

    const needed = parseUnitsString(unitsToSend);

    let bestVillage = null;
    let bestDistance = Infinity;

    ownVillages.forEach((village) => {
        const villageTroops = troopCounts.find(
            (troops) => troops.villageId === village.id
        );

        if (!villageTroops) return;

        const hasEnoughUnits =
            (villageTroops.axe || 0) >= needed.axe &&
            (villageTroops.ram || 0) >= needed.ram &&
            (villageTroops.catapult || 0) >= needed.catapult &&
            (villageTroops.spy || 0) >= needed.spy;

        if (!hasEnoughUnits) return;

        const dist = calculateDistance(village.coords, targetCoord);

        if (dist < bestDistance) {
            bestDistance = dist;
            bestVillage = {
                id: village.id,
                name: village.name,
                coord: village.coords,
                distance: dist,
            };
        }
    });

    return bestVillage;
}

// Fetch FA pages
async function fetchFAPages(maxFAPagesToFetch) {
    const faPageURLs = await jQuery
        .get(game_data.link_base_pure + 'am_farm')
        .then((response) => {
            const htmlDoc = jQuery.parseHTML(response);
            const plunderListNav = jQuery(htmlDoc).find(
                '#plunder_list_nav:eq(0) a'
            );
            const firstFApage =
                game_data.link_base_pure +
                `am_farm&ajax=page_entries&Farm_page=0&class=&extended=1`;

            const faPageURLs = [firstFApage];
            jQuery(plunderListNav).each(function (index) {
                index++;
                if (index <= maxFAPagesToFetch - 1) {
                    const currentPageNumber = parseInt(
                        getParameterByName(
                            'Farm_page',
                            window.location.origin + jQuery(this).attr('href')
                        ),
                        10
                    );
                    faPageURLs.push(
                        game_data.link_base_pure +
                            `am_farm&ajax=page_entries&Farm_page=${currentPageNumber}&class=&extended=1&order=distance&dir=asc`
                    );
                }
            });

            return faPageURLs;
        })
        .catch((error) => {
            UI.ErrorMessage('Error fetching FA page!');
            console.error(`${scriptInfo()} Error:`, error);
            return [];
        });

    return faPageURLs;
}

function getFATableRows(pages) {
    let barbariansText = '';
    pages.forEach((page) => {
        barbariansText += page;
    });
    return jQuery.parseHTML(barbariansText);
}

// Keep only orange/yellow reports
function getFABarbarians(rows) {
    let barbarians = [];

    rows.forEach((row) => {
        let shouldAdd = false;

        const lastCellLink = jQuery(row).find('td').last().find('a').attr('href');
        const reportCellLink = jQuery(row).find('td:eq(3) a').attr('href');
        const coordCellText = jQuery(row).find('td:eq(3) a').text();

        if (!lastCellLink || !reportCellLink || !coordCellText.match(COORDS_REGEX)) {
            return;
        }

        let villageId = parseInt(
            getParameterByName(
                'target',
                window.location.origin + lastCellLink
            ),
            10
        );
        let coord = coordCellText.match(COORDS_REGEX)[0];
        let wall = jQuery(row).find('td:eq(6)').text().trim();
        let distance = jQuery(row).find('td:eq(7)').text().trim();
        let reportId = parseInt(
            getParameterByName(
                'view',
                window.location.origin + reportCellLink
            ),
            10
        );
        let reportTime = jQuery(row).find('td:eq(4)').text().trim();
        let type = jQuery(row).find('td:eq(1) img').attr('src');

        const isGreenReport = type && type.includes('green.webp');
        const isRedReport = type && type.includes('red.webp');
        const isOrangeReport =
            type &&
            (
                type.includes('yellow.webp') ||
                type.includes('orange.webp') ||
                type.includes('yellow.png') ||
                type.includes('orange.png')
            );

        if (parseInt(wall, 10) > 0 || wall === '?') {
            shouldAdd = true;

            if (isGreenReport) shouldAdd = false;
            if (isRedReport) shouldAdd = false;
            if (!isOrangeReport) shouldAdd = false;
        }

        if (shouldAdd && villageId && reportId) {
            barbarians.push({
                villageId: villageId,
                coord: coord,
                distance: distance,
                wall: wall,
                reportId: reportId,
                reportTime: reportTime,
                type: type,
            });
        }
    });

    return barbarians;
}

// Troop template from settings
function calculateUnitsToSend(store) {
    const axe = sanitizeNumber(store.AXE, 10);
    const ram = sanitizeNumber(store.RAM, 8);
    const catapult = sanitizeNumber(store.CATAPULT, 6);
    const spy = sanitizeNumber(store.SPY, 1);

    return `&axe=${axe}&ram=${ram}&catapult=${catapult}&spy=${spy}`;
}

// AJAX fetchAll
$.fetchAll = function (urls, onLoad, onDone, onError) {
    var numDone = 0;
    var lastRequestTime = 0;
    var minWaitTime = 250;
    loadNext();

    function loadNext() {
        if (numDone == urls.length) {
            onDone();
            return;
        }

        let now = Date.now();
        let timeElapsed = now - lastRequestTime;
        if (timeElapsed < minWaitTime) {
            let timeRemaining = minWaitTime - timeElapsed;
            setTimeout(loadNext, timeRemaining);
            return;
        }

        lastRequestTime = now;
        $.get(urls[numDone])
            .done((data) => {
                try {
                    onLoad(numDone, data);
                    ++numDone;
                    loadNext();
                } catch (e) {
                    onError(e);
                }
            })
            .fail((xhr) => {
                onError(xhr);
            });
    }
};

// Progress bar
function startProgressBar(total) {
    const width = jQuery('#contentContainer')[0].clientWidth;
    const preloaderContent = `
		<div id="progressbar" class="progress-bar" style="margin-bottom:12px;">
        	<span class="count label">0/${total}</span>
        	<div id="progress">
				<span class="count label" style="width: ${width}px;">
					0/${total}
				</span>
			</div>
    	</div>
	`;
    $('#contentContainer').eq(0).prepend(preloaderContent);
}

function updateProgressBar(index, total) {
    jQuery('#progress').css('width', `${((index + 1) / total) * 100}%`);
    jQuery('.count').text(`${tt('Fetching')} ${index + 1}/${total}`);
    if (index + 1 == total) {
        UI.SuccessMessage(tt('Finished fetching FA pages!'));
        jQuery('#progressbar').fadeOut(1000);
    }
}

// Storage helpers
function readStorage(defaultState) {
    let storedState = sessionStorage.getItem(STORAGE_KEY);
    if (!storedState) return defaultState;
    if (typeof storedState === 'object') return defaultState;
    storedState = JSON.parse(storedState);
    return {
        ...defaultState,
        ...storedState,
    };
}

function writeStorage(data, initialState) {
    const dataToBeSaved = {
        ...initialState,
        ...data,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataToBeSaved));
}

function sanitizeNumber(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// Utils
function getParameterByName(name, url = window.location.href) {
    return new URL(url).searchParams.get(name);
}

function scriptInfo() {
    return `[${scriptData.name} ${scriptData.version}]`;
}

function initDebug() {
    console.debug(`${scriptInfo()} It works 🚀!`);
    console.debug(`${scriptInfo()} HELP:`, scriptData.helpLink);
    if (DEBUG) {
        console.debug(`${scriptInfo()} Market:`, game_data.market);
        console.debug(`${scriptInfo()} World:`, game_data.world);
        console.debug(`${scriptInfo()} Screen:`, game_data.screen);
        console.debug(`${scriptInfo()} Game Version:`, game_data.majorVersion);
        console.debug(`${scriptInfo()} Game Build:`, game_data.version);
        console.debug(`${scriptInfo()} Locale:`, game_data.locale);
        console.debug(
            `${scriptInfo()} Premium:`,
            game_data.features.Premium.active
        );
    }
}

function tt(string) {
    var gameLocale = game_data.locale;

    if (translations[gameLocale] !== undefined) {
        return translations[gameLocale][string] || string;
    } else {
        return translations['en_DK'][string] || string;
    }
}

// Initialize
(function () {
    if (
        game_data.features.FarmAssistent.active &&
        game_data.features.Premium.active
    ) {
        const gameScreen = getParameterByName('screen');
        if (ALLOWED_GAME_SCREENS.includes(gameScreen)) {
            const state = readStorage(DEFAULT_STATE);
            initClearBarbarianWalls(state);
        } else {
            UI.InfoMessage(tt('Redirecting...'));
            window.location.assign(game_data.link_base_pure + 'map');
        }
    } else {
        UI.ErrorMessage(tt('This script requires PA and FA to be active!'));
    }
})();

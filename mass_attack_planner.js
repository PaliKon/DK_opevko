/*
 * Script Name: Mass Attack Planner
 * Version: v1.4.0-custom
 * Last Updated: 2026-04-21
 * Author: Syleion
 * Author URL: https://www.facebook.com/rado.mike
 */

/*--------------------------------------------------------------------------------------
 * Custom combined version:
 * - blocked send-time slider
 * - per-target nuke table
 * - no external helper dependency
 --------------------------------------------------------------------------------------*/

var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.4.0-custom',
    author: 'Syleion',
    authorUrl: 'https://www.facebook.com/rado.mike',
    helpLink:
        'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/',
};

if (typeof DEBUG !== 'boolean') DEBUG = false;

var LS_PREFIX = `ra_massAttackPlanner_`;
var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30;
var LAST_UPDATED_TIME = parseInt(
    localStorage.getItem(`${LS_PREFIX}_last_updated`) || '0',
    10
);

var unitInfo;

initDebug();

(function () {
    if (LAST_UPDATED_TIME) {
        if (Date.parse(new Date()) >= LAST_UPDATED_TIME + TIME_INTERVAL) {
            fetchUnitInfo();
        } else {
            unitInfo = JSON.parse(
                localStorage.getItem(`${LS_PREFIX}_unit_info`)
            );
            init(unitInfo);
        }
    } else {
        fetchUnitInfo();
    }
})();

function init(unitInfo) {
    var currentDateTime = getCurrentDateTime();

    let knightSpeed = 0;
    const worldUnits = game_data.units;
    if (worldUnits.includes('knight')) {
        knightSpeed = unitInfo?.config['knight']?.speed || 0;
    }

    const content = `
        <div class="ra-mb15">
            <label for="arrival_time">Arrival Time</label>
            <input id="arrival_time" type="text" placeholder="yyyy-mm-dd hh:mm:ss" value="${currentDateTime}">
        </div>

        <div class="ra-box ra-mb15">
            <label class="ra-inline-label">
                <input id="exclude_blocked_attacks" type="checkbox">
                Ignore attacks that must be sent during blocked hours
            </label>

            <div id="blocked_time_wrap" class="ra-mt10" style="display:none;">
                <div class="ra-flex ra-gap10">
                    <div class="ra-flex-6">
                        <label for="blocked_from_slider">Blocked from</label>
                        <input id="blocked_from_slider" type="range" min="0" max="23" step="1" value="0">
                        <div class="ra-slider-value"><span id="blocked_from_value">00:00</span></div>
                    </div>
                    <div class="ra-flex-6">
                        <label for="blocked_to_slider">Blocked until</label>
                        <input id="blocked_to_slider" type="range" min="0" max="23" step="1" value="8">
                        <div class="ra-slider-value"><span id="blocked_to_value">08:00</span></div>
                    </div>
                </div>

                <input type="hidden" id="blocked_from" value="00:00">
                <input type="hidden" id="blocked_to" value="08:00">

                <small>
                    Example: 00:00 → 08:00 or 01:00 → 09:00. Intervals crossing midnight also work, e.g. 23:00 → 06:00.
                </small>
            </div>
        </div>

        <input type="hidden" id="nobleSpeed" value="${unitInfo.config['snob'].speed}" />

        <div class="ra-flex">
            <div class="ra-flex-6">
                <div class="ra-mb15">
                    <label for="nuke_unit">Slowest Nuke unit</label>
                    <select id="nuke_unit">
                        <option value="${unitInfo.config['axe'].speed}">Axe</option>
                        <option value="${unitInfo.config['light'].speed}">LC/MA/Paladin</option>
                        <option value="${unitInfo.config['heavy'].speed}">HC</option>
                        <option value="${unitInfo.config['ram'].speed}" selected="selected">Ram/Cat</option>
                    </select>
                </div>
            </div>

            <div class="ra-flex-6">
                <div class="ra-mb15">
                    <label for="support_unit">Slowest Support unit</label>
                    <select id="support_unit">
                        <option value="${unitInfo.config['spear'].speed}">Spear/Archer</option>
                        <option value="${unitInfo.config['sword'].speed}" selected="selected">Sword</option>
                        <option value="${unitInfo.config['spy'].speed}">Spy</option>
                        ${
                            worldUnits.includes('knight')
                                ? `<option value="${knightSpeed}" data-option-unit="knight">Paladin</option>`
                                : ''
                        }
                        <option value="${unitInfo.config['heavy'].speed}">HC</option>
                        <option value="${unitInfo.config['catapult'].speed}">Cat</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="ra-mb15">
            <label for="target_coords">Targets Coords</label>
            <textarea id="target_coords"></textarea>
            <small>Paste one target coordinate per line. Then click "Build Target Table".</small>
        </div>

        <div class="ra-mb15 ra-flex ra-gap10">
            <a id="build_target_table_btn" class="button" onclick="buildTargetTable();">Build Target Table</a>
            <a id="clear_target_table_btn" class="button button-alt" onclick="clearTargetTable();">Clear Table</a>
        </div>

        <div id="target_table_wrap" class="ra-mb15" style="display:none;">
            <label>Per-target nuke settings</label>
            <div class="ra-box">
                <small class="ra-mb10">
                    For each target, enter:
                    <strong>number</strong> = custom nukes,
                    <strong>G</strong> = use global "Nukes per Target",
                    empty = also use global.
                </small>
                <div id="target_table_container"></div>
            </div>
        </div>

        <div class="ra-flex">
            <div class="ra-flex-4">
                <div class="ra-mb15">
                    <label for="nobel_coords">Nobles Coords</label>
                    <textarea id="nobel_coords"></textarea>
                </div>
                <div class="ra-mb15">
                    <label for="nobel_count">Nobles per Target</label>
                    <input id="nobel_count" type="text" value="1">
                </div>
            </div>

            <div class="ra-flex-4">
                <div class="ra-mb15">
                    <label for="nuke_coords">Nukes Coords</label>
                    <textarea id="nuke_coords"></textarea>
                </div>
                <div class="ra-mb15">
                    <label for="nuke_count">Nukes per Target</label>
                    <input id="nuke_count" type="text" value="1">
                    <small>Used as global fallback and for targets marked with G.</small>
                </div>
            </div>

            <div class="ra-flex-4">
                <div class="ra-mb15">
                    <label for="support_coords">Support Coords</label>
                    <textarea id="support_coords"></textarea>
                </div>
                <div class="ra-mb15">
                    <label for="support_count">Support per Target</label>
                    <input id="support_count" type="text" value="1">
                </div>
            </div>
        </div>

        <div class="ra-mb15">
            <a id="submit_btn" class="button" onclick="handleSubmit();">Get Plan!</a>
        </div>

        <div class="ra-mb15">
            <label for="results">Results</label>
            <textarea id="results" style="height:160px;"></textarea>
        </div>
    `;

    const windowContent = prepareWindowContent(content);
    attackPlannerWindow = window.open(
        '',
        '',
        'left=10px,top=10px,width=640,height=900,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0'
    );
    attackPlannerWindow.document.write(windowContent);
    attackPlannerWindow.document.close();
}

function prepareWindowContent(windowBody) {
    const windowHeader = `
    <div class="ra-header">
        <div class="ra-header-left">
            <h1 class="ra-fs18 ra-fw600">${scriptData.name}</h1>
        </div>
        <div class="ra-header-right">
            <img src="https://raw.githubusercontent.com/PaliKon/DK_opevko/main/spawn_rado_finsko_achilles.jpg" class="ra-header-logo">
        </div>
    </div>
`;
    const windowFooter = `<small><strong>${scriptData.name} ${scriptData.version}</strong> - <a href="${scriptData.authorUrl}" target="_blank" rel="noreferrer noopener">${scriptData.author}</a> - <a href="${scriptData.helpLink}" target="_blank" rel="noreferrer noopener">Help</a></small>`;

    const windowStyle = `
        <style>
            body {
                background-color: #f4e4bc;
                font-family: Verdana, Arial, sans-serif;
                font-size: 14px;
                line-height: 1.3;
                color: #2f1b00;
                margin: 0;
                padding: 10px;
                box-sizing: border-box;
            }
            * { box-sizing: border-box; }
            main { max-width: 900px; margin: 0 auto; }
            h1 { font-size: 26px; margin: 0 0 15px; }
            a { font-weight: 700; text-decoration: none; color: #603000; }
            small { font-size: 11px; line-height: 1.4; display: block; }
            label { font-weight: 600; display: block; margin-bottom: 5px; font-size: 12px; }
            input[type="text"], select, textarea {
                display: block; width: 100%; box-sizing: border-box; padding: 5px;
                outline: none; border: 1px solid #999; background: #fff;
            }
            input[type="text"]:focus, select:focus, textarea:focus {
                outline: none; box-shadow: none; border: 1px solid #603000; background-color: #eee;
            }
            input[type="range"] { width: 100%; margin: 8px 0 4px; }
            textarea { width: 100%; height: 80px; resize: none; }
            .ra-inline-label { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
            .ra-inline-label input[type="checkbox"] { margin: 0; }
            .ra-box { border: 1px solid #b89b68; background: rgba(255,255,255,0.25); padding: 10px; }
            .ra-slider-value { font-weight: 700; color: #603000; font-size: 12px; text-align: center; margin-top: 4px; }
            .ra-mb10 { margin-bottom: 10px; }
            .ra-mb15 { margin-bottom: 15px; }
            .ra-mt10 { margin-top: 10px; }
            .ra-gap10 { gap: 10px; }
            .ra-flex { display: flex; flex-flow: row wrap; justify-content: space-between; }
            .ra-flex-6 { flex: 0 0 48%; }
            .ra-flex-4 { flex: 0 0 31.5%; }
            .button {
                padding: 10px 20px; background-color: #603000; font-weight: 500; color: #fff;
                text-align: center; display: inline-block; cursor: pointer; text-transform: uppercase;
            }
            .button-alt { background-color: #8b6b3e; }
            .ra-table-wrap { max-height: 260px; overflow-y: auto; border: 1px solid #b89b68; background: #f9f3e0; }
            .ra-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .ra-table th, .ra-table td {
                border: 1px solid #c9b182; padding: 6px; text-align: left; vertical-align: middle;
                font-size: 12px; background: rgba(255,255,255,0.45);
            }
            .ra-table th { background: #e6d3a4; position: sticky; top: 0; z-index: 1; }
            .ra-target-count-input { width: 80px !important; text-align: center; font-weight: 700; }
            .ra-target-coord { font-weight: 700; letter-spacing: 0.2px; }
            .ra-note { font-size: 11px; color: #5a3d11; }
            @media (max-width: 600px) {
                .ra-flex-6, .ra-flex-4 { flex: 0 0 100%; }
            }
            .ra-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 15px;
            }
            
            .ra-header-left {
                flex: 1;
            }
            
            .ra-header-right {
                flex: 0 0 auto;
            }
            
            .ra-header-logo {
                max-width: 80px;
                max-height: 80px;
                display: block;
                border: 1px solid #b89b68;
                background: #fff8e8;
                padding: 3px;
            }
        </style>
    `;

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${scriptData.name} ${scriptData.version}</title>
            ${windowStyle}
        </head>
        <body>
            <main>
                ${windowHeader}
                ${windowBody}
                ${windowFooter}
            </main>

            <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
            <script>
                function formatSliderHour(value) {
                    return String(value).padStart(2, '0') + ':00';
                }

                function syncBlockedRangeUI() {
                    var fromSlider = document.getElementById('blocked_from_slider');
                    var toSlider = document.getElementById('blocked_to_slider');
                    var fromValue = document.getElementById('blocked_from_value');
                    var toValue = document.getElementById('blocked_to_value');
                    var fromHidden = document.getElementById('blocked_from');
                    var toHidden = document.getElementById('blocked_to');

                    if (!fromSlider || !toSlider || !fromValue || !toValue || !fromHidden || !toHidden) return;

                    var fromFormatted = formatSliderHour(fromSlider.value);
                    var toFormatted = formatSliderHour(toSlider.value);

                    fromValue.textContent = fromFormatted;
                    toValue.textContent = toFormatted;
                    fromHidden.value = fromFormatted;
                    toHidden.value = toFormatted;
                }

                function initBlockedTimeUI() {
                    var checkbox = document.getElementById('exclude_blocked_attacks');
                    var wrap = document.getElementById('blocked_time_wrap');
                    var fromSlider = document.getElementById('blocked_from_slider');
                    var toSlider = document.getElementById('blocked_to_slider');

                    function toggleWrap() {
                        if (!checkbox || !wrap) return;
                        wrap.style.display = checkbox.checked ? 'block' : 'none';
                    }

                    if (checkbox) {
                        checkbox.addEventListener('change', toggleWrap);
                        toggleWrap();
                    }

                    if (fromSlider) fromSlider.addEventListener('input', syncBlockedRangeUI);
                    if (toSlider) toSlider.addEventListener('input', syncBlockedRangeUI);

                    syncBlockedRangeUI();
                }

                function getUniqueTargetCoords() {
                    var raw = document.getElementById('target_coords').value || '';
                    var matches = raw.match(/[0-9]{1,3}\\|[0-9]{1,3}/g) || [];
                    var unique = [];
                    var seen = {};

                    for (var i = 0; i < matches.length; i++) {
                        if (!seen[matches[i]]) {
                            seen[matches[i]] = true;
                            unique.push(matches[i]);
                        }
                    }

                    return unique;
                }

                function buildTargetTable() {
                    var targets = getUniqueTargetCoords();
                    var container = document.getElementById('target_table_container');
                    var wrap = document.getElementById('target_table_wrap');

                    if (!container || !wrap) return;

                    if (!targets.length) {
                        container.innerHTML = '<div class="ra-note">No valid target coordinates found.</div>';
                        wrap.style.display = 'block';
                        return;
                    }

                    var existingValues = {};
                    var oldInputs = document.querySelectorAll('.ra-target-count-input');
                    oldInputs.forEach(function(input) {
                        existingValues[input.getAttribute('data-target')] = input.value;
                    });

                    var html = '<div class="ra-table-wrap"><table class="ra-table"><thead><tr><th style="width:70%;">Target</th><th style="width:30%;">Nukes</th></tr></thead><tbody>';

                    for (var i = 0; i < targets.length; i++) {
                        var coord = targets[i];
                        var currentValue = typeof existingValues[coord] !== 'undefined' ? existingValues[coord] : 'G';
                        html += '<tr>';
                        html += '<td><span class="ra-target-coord">' + coord + '</span></td>';
                        html += '<td><input type="text" class="ra-target-count-input" data-target="' + coord + '" value="' + currentValue + '" placeholder="G"></td>';
                        html += '</tr>';
                    }

                    html += '</tbody></table></div>';
                    container.innerHTML = html;
                    wrap.style.display = 'block';
                }

                function clearTargetTable() {
                    var container = document.getElementById('target_table_container');
                    var wrap = document.getElementById('target_table_wrap');
                    if (container) container.innerHTML = '';
                    if (wrap) wrap.style.display = 'none';
                }

                function parseTimeToMinutes(timeStr) {
                    if (!timeStr || timeStr.indexOf(':') === -1) return null;
                    var parts = timeStr.split(':');
                    var hours = parseInt(parts[0], 10);
                    var minutes = parseInt(parts[1], 10);

                    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                        return null;
                    }
                    return hours * 60 + minutes;
                }

                function isLaunchTimeBlocked(dateObj, blockedFrom, blockedTo) {
                    var fromMinutes = parseTimeToMinutes(blockedFrom);
                    var toMinutes = parseTimeToMinutes(blockedTo);

                    if (fromMinutes === null || toMinutes === null) return false;

                    var currentMinutes = dateObj.getHours() * 60 + dateObj.getMinutes();

                    if (fromMinutes < toMinutes) {
                        return currentMinutes >= fromMinutes && currentMinutes < toMinutes;
                    }

                    if (fromMinutes > toMinutes) {
                        return currentMinutes >= fromMinutes || currentMinutes < toMinutes;
                    }

                    return true;
                }

                function getBlockedTimeSettings() {
                    return {
                        enabled: $('#exclude_blocked_attacks').is(':checked'),
                        from: $('#blocked_from').val() || '00:00',
                        to: $('#blocked_to').val() || '08:00'
                    };
                }

                function isValidArrivalDate(dateString) {
                    var date = new Date(dateString);
                    return !isNaN(date.getTime());
                }

                function getUniqueCoordsFromTextarea(selector) {
                    var raw = $(selector).val() || '';
                    var matches = raw.match(/[0-9]{1,3}\\|[0-9]{1,3}/g) || [];
                    var unique = [];
                    var seen = {};

                    for (var i = 0; i < matches.length; i++) {
                        if (!seen[matches[i]]) {
                            seen[matches[i]] = true;
                            unique.push(matches[i]);
                        }
                    }

                    return unique.length ? unique : null;
                }

                function getTargetsFromTableOrTextarea() {
                    var tableInputs = $('.ra-target-count-input');
                    var targets = [];

                    if (tableInputs.length) {
                        tableInputs.each(function () {
                            var coord = $(this).attr('data-target');
                            if (coord) targets.push(coord);
                        });
                        return targets.length ? targets : null;
                    }

                    return getUniqueCoordsFromTextarea('textarea#target_coords');
                }

                function getPerTargetNukeLimits(globalCount, targets) {
                    var limits = {};
                    var tableInputs = $('.ra-target-count-input');

                    if (!tableInputs.length) {
                        for (var i = 0; i < targets.length; i++) {
                            limits[targets[i]] = globalCount;
                        }
                        return limits;
                    }

                    tableInputs.each(function () {
                        var coord = $(this).attr('data-target');
                        var raw = ($(this).val() || '').trim().toUpperCase();

                        if (!coord) return;

                        if (raw === '' || raw === 'G') {
                            limits[coord] = globalCount;
                            return;
                        }

                        var parsed = parseInt(raw, 10);
                        if (isNaN(parsed) || parsed < 0) {
                            throw new Error('Invalid nuke count for target ' + coord + ': ' + raw);
                        }

                        limits[coord] = parsed;
                    });

                    for (var i = 0; i < targets.length; i++) {
                        if (typeof limits[targets[i]] === 'undefined') {
                            limits[targets[i]] = globalCount;
                        }
                    }

                    return limits;
                }

                function clean(clean_me, of_these) {
                    if (!clean_me) return null;
                    if (!of_these) return clean_me;

                    var cleaned = [];
                    for (var element in clean_me) {
                        if (of_these.indexOf(clean_me[element]) == -1) {
                            cleaned.push(clean_me[element]);
                        }
                    }
                    return cleaned.length ? cleaned : null;
                }

                function calculateDistance(villageA, villageB) {
                    const x1 = villageA.split('|')[0];
                    const y1 = villageA.split('|')[1];
                    const x2 = villageB.split('|')[0];
                    const y2 = villageB.split('|')[1];

                    const deltaX = Math.abs(x1 - x2);
                    const deltaY = Math.abs(y1 - y2);

                    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                }

                function fnCalculateLaunchTime(source, target, unitSpeed, landingTime) {
                    var distance = calculateDistance(target, source);
                    var landingTimeObject = new Date(landingTime);

                    const msPerSec = 1000;
                    const secsPerMin = 60;
                    const msPerMin = msPerSec * secsPerMin;
                    const unitTime = distance * unitSpeed * msPerMin;

                    var launchTime = new Date();
                    launchTime.setTime(
                        Math.round((landingTimeObject.getTime() - unitTime) / msPerSec) * msPerSec
                    );

                    return launchTime;
                }

                function get_travel_times(attackers, defenders, speed, arrival_time) {
                    var travel_times = [];
                    var blockedSettings = getBlockedTimeSettings();

                    for (var i = 0; i < attackers.length; i++) {
                        travel_times[attackers[i]] = [];

                        for (var j = 0; j < defenders.length; j++) {
                            var currentLaunchTime = fnCalculateLaunchTime(
                                attackers[i],
                                defenders[j],
                                speed,
                                arrival_time
                            );

                            if (
                                blockedSettings.enabled &&
                                isLaunchTimeBlocked(
                                    currentLaunchTime,
                                    blockedSettings.from,
                                    blockedSettings.to
                                )
                            ) {
                                continue;
                            }

                            travel_times[attackers[i]][defenders[j]] = currentLaunchTime.getTime();
                        }
                    }

                    return travel_times;
                }

                function getTargetLimit(targetLimitsOrNumber, defend) {
                    if (typeof targetLimitsOrNumber === 'number') return targetLimitsOrNumber;

                    if (typeof targetLimitsOrNumber === 'object' && targetLimitsOrNumber !== null) {
                        return parseInt(targetLimitsOrNumber[defend] || 0, 10);
                    }

                    return 0;
                }

                function get_plan(travel_times, targetLimitsOrNumber, type) {
                    var plan = [];
                    var used_targets = [];

                    for (var attack in travel_times) {
                        var fastest = Number.MAX_SAFE_INTEGER;
                        var target = '';
                        var travel_time = '';
                        plan[attack] = [];

                        for (var defend in travel_times[attack]) {
                            if (typeof used_targets[defend] === 'undefined') {
                                used_targets[defend] = 0;
                            }

                            var currentTargetLimit = getTargetLimit(targetLimitsOrNumber, defend);
                            if (currentTargetLimit <= 0) continue;

                            if (used_targets[defend] < currentTargetLimit) {
                                if (travel_times[attack][defend] < fastest) {
                                    target = defend;
                                    travel_time = travel_times[attack][defend];
                                    fastest = travel_time;
                                }
                            }
                        }

                        if (target !== '' && travel_time !== '') {
                            used_targets[target] = used_targets[target] + 1;
                            plan[attack]['target'] = target;
                            plan[attack]['travel_time'] = travel_time;
                            plan[attack]['type'] = type;
                        }
                    }

                    return plan;
                }

                function merge(array1, array2) {
                    for (var element in array2) {
                        if (typeof array1[element] === 'undefined') {
                            array1[element] = array2[element];
                        }
                    }
                    return array1;
                }

                function sort(array) {
                    var stored_by_time = [];
                    var sorted = [];
                    var keys = [];
                    var increment = 0.000000000001;

                    for (var element in array) {
                        if (typeof array[element]['travel_time'] !== 'undefined') {
                            var time;
                            if (typeof stored_by_time[array[element]['travel_time']] === 'undefined') {
                                time = array[element]['travel_time'];
                            } else {
                                time = array[element]['travel_time'] + increment;
                                increment += increment;
                            }

                            stored_by_time[time] = array[element];
                            stored_by_time[time]['attacker'] = element;
                        }
                    }

                    for (var storedElement in stored_by_time) {
                        keys.push(storedElement);
                    }

                    keys.sort(function (a, b) { return a - b; });

                    for (var key in keys) {
                        var plan = [];
                        plan['attacker'] = stored_by_time[keys[key]]['attacker'];
                        plan['target'] = stored_by_time[keys[key]]['target'];
                        plan['type'] = stored_by_time[keys[key]]['type'];
                        plan['travel_time'] = stored_by_time[keys[key]]['travel_time'];
                        sorted.push(plan);
                    }

                    return sorted;
                }

                function formatDateTime(date) {
                    let currentDateTime = new Date(date);

                    var currentYear = currentDateTime.getFullYear();
                    var currentMonth = currentDateTime.getMonth() + 1;
                    var currentDate = String(currentDateTime.getDate()).padStart(2, '0');
                    var currentHours = String(currentDateTime.getHours()).padStart(2, '0');
                    var currentMinutes = String(currentDateTime.getMinutes()).padStart(2, '0');
                    var currentSeconds = String(currentDateTime.getSeconds()).padStart(2, '0');

                    currentMonth = String(currentMonth).padStart(2, '0');

                    return currentDate + '/' + currentMonth + '/' + currentYear + ' ' +
                        currentHours + ':' + currentMinutes + ':' + currentSeconds;
                }

                function get_troop(type) {
                    var unit = '';
                    var unitSpeed = '';

                    if (type == 'nobel') {
                        return '[unit]snob[/unit]';
                    } else if (type == 'nuke') {
                        unitSpeed = $('#nuke_unit').val();
                    } else if (type == 'support') {
                        unitSpeed = $('#support_unit').val();
                    }

                    Object.entries(window.opener ? window.opener.unitInfo.config : {}).map((currentUnit) => {
                        if (currentUnit[1].speed === unitSpeed) {
                            unit = '[unit]' + currentUnit[0] + '[/unit]';

                            if (type === 'nuke') {
                                if (currentUnit[0] === 'knight') unit = '[unit]light[/unit]';
                                if (currentUnit[0] === 'archer') unit = '[unit]axe[/unit]';
                                if (currentUnit[0] === 'catapult') unit = '[unit]ram[/unit]';
                            } else {
                                if (currentUnit[0] === 'archer') unit = '[unit]spear[/unit]';
                                if (currentUnit[0] === 'light') unit = '[unit]paladin[/unit]';
                                if (currentUnit[0] === 'marcher') unit = '[unit]paladin[/unit]';
                            }
                        }
                    });

                    return unit;
                }

                function get_twcode(plan, land_time) {
                    var twcode = '[size=12][b]Landing time: ' + land_time + '[/b][/size]\\n\\n';

                    if (!plan || !plan.length) {
                        return twcode + '[b]No valid plans found with the current settings.[/b]';
                    }

                    var colour = '';

                    for (var attack in plan) {
                        if (
                            plan[attack]['target'] != undefined ||
                            plan[attack]['travel_time'] != undefined ||
                            plan[attack]['type'] != undefined
                        ) {
                            if (plan[attack]['type'] == 'nobel') colour = '#2eb92e';
                            else if (plan[attack]['type'] == 'nuke') colour = '#ff0e0e';
                            else if (plan[attack]['type'] == 'support') colour = '#0eaeae';

                            var launch_time = new Date(plan[attack]['travel_time']);
                            var formattedDate = formatDateTime(launch_time);

                            twcode +=
                                get_troop(plan[attack]['type']) +
                                ' - ' +
                                plan[attack]['attacker'] +
                                ' - ' +
                                plan[attack]['target'] +
                                ' - [b][color=' +
                                colour +
                                ']' +
                                formattedDate +
                                '[/color][/b]\\n';
                        }
                    }

                    return twcode;
                }

                function handleSubmit() {
                    try {
                        var arrival_time = $('#arrival_time').val();

                        if (!isValidArrivalDate(arrival_time)) {
                            alert('Invalid arrival time! Use format: yyyy-mm-dd hh:mm:ss');
                            return;
                        }

                        var blockedSettings = getBlockedTimeSettings();
                        if (blockedSettings.enabled) {
                            if (
                                parseTimeToMinutes(blockedSettings.from) === null ||
                                parseTimeToMinutes(blockedSettings.to) === null
                            ) {
                                alert('Invalid blocked time range!');
                                return;
                            }
                        }

                        var nuke_speed = parseFloat($('#nuke_unit').val());
                        var support_speed = parseFloat($('#support_unit').val());
                        var nobel_speed = parseFloat($('#nobleSpeed').val());

                        var nobel_coords = getUniqueCoordsFromTextarea('#nobel_coords');
                        var nuke_coords;
                        var support_coords;

                        if (nobel_coords == null) {
                            nuke_coords = getUniqueCoordsFromTextarea('#nuke_coords');
                            if (nuke_coords == null) {
                                support_coords = getUniqueCoordsFromTextarea('#support_coords');
                            } else {
                                support_coords = clean(
                                    getUniqueCoordsFromTextarea('#support_coords'),
                                    nuke_coords
                                );
                            }
                        } else {
                            nuke_coords = clean(
                                getUniqueCoordsFromTextarea('#nuke_coords'),
                                nobel_coords
                            );

                            if (nuke_coords == null) {
                                support_coords = clean(
                                    getUniqueCoordsFromTextarea('#support_coords'),
                                    nobel_coords
                                );
                            } else {
                                support_coords = clean(
                                    clean(
                                        getUniqueCoordsFromTextarea('#support_coords'),
                                        nobel_coords
                                    ),
                                    nuke_coords
                                );
                            }
                        }

                        var targets_coords = getTargetsFromTableOrTextarea();
                        var nuke_count = parseInt($('#nuke_count').val(), 10) || 0;
                        var support_count = parseInt($('#support_count').val(), 10) || 0;
                        var nobel_count = parseInt($('#nobel_count').val(), 10) || 0;

                        if (!targets_coords || !targets_coords.length) {
                            alert('Please enter target coordinates and build the target table!');
                            return;
                        }

                        var nukeTargetLimits;
                        try {
                            nukeTargetLimits = getPerTargetNukeLimits(nuke_count, targets_coords);
                        } catch (e) {
                            alert(e.message);
                            return;
                        }

                        var all_plans = [];

                        $('#target_coords').val(targets_coords.join('\\n'));

                        if (nobel_coords && nobel_coords.length) {
                            var nobleTravelTimes = get_travel_times(
                                nobel_coords, targets_coords, nobel_speed, arrival_time
                            );
                            $('#nobel_coords').val(nobel_coords.join('\\n'));
                            all_plans = merge(all_plans, get_plan(nobleTravelTimes, nobel_count, 'nobel'));
                        }

                        if (nuke_coords && nuke_coords.length) {
                            var nukeTravelTimes = get_travel_times(
                                nuke_coords, targets_coords, nuke_speed, arrival_time
                            );
                            $('#nuke_coords').val(nuke_coords.join('\\n'));
                            all_plans = merge(all_plans, get_plan(nukeTravelTimes, nukeTargetLimits, 'nuke'));
                        }

                        if (support_coords && support_coords.length) {
                            var supportTravelTimes = get_travel_times(
                                support_coords, targets_coords, support_speed, arrival_time
                            );
                            $('#support_coords').val(support_coords.join('\\n'));
                            all_plans = merge(all_plans, get_plan(supportTravelTimes, support_count, 'support'));
                        }

                        all_plans = sort(all_plans);
                        $('#results').val(get_twcode(all_plans, arrival_time));
                    } catch (error) {
                        console.error(error);
                        alert('Planner error: ' + error.message);
                    }
                }

                document.addEventListener('DOMContentLoaded', function () {
                    initBlockedTimeUI();
                });
            </script>
        </body>
        </html>
    `;

    return html;
}

function getCurrentDateTime() {
    let currentDateTime = new Date();

    var currentYear = currentDateTime.getFullYear();
    var currentMonth = String(currentDateTime.getMonth() + 1).padStart(2, '0');
    var currentDate = String(currentDateTime.getDate()).padStart(2, '0');
    var currentHours = String(currentDateTime.getHours()).padStart(2, '0');
    var currentMinutes = String(currentDateTime.getMinutes()).padStart(2, '0');
    var currentSeconds = String(currentDateTime.getSeconds()).padStart(2, '0');

    return (
        currentYear +
        '-' +
        currentMonth +
        '-' +
        currentDate +
        ' ' +
        currentHours +
        ':' +
        currentMinutes +
        ':' +
        currentSeconds
    );
}

function fetchUnitInfo() {
    jQuery
        .ajax({
            url: '/interface.php?func=get_unit_info',
        })
        .done(function (response) {
            unitInfo = xml2json($(response));
            localStorage.setItem(
                `${LS_PREFIX}_unit_info`,
                JSON.stringify(unitInfo)
            );
            localStorage.setItem(
                `${LS_PREFIX}_last_updated`,
                Date.parse(new Date())
            );
            init(unitInfo);
        });
}

var xml2json = function ($xml) {
    var data = {};
    $.each($xml.children(), function (i) {
        var $this = $(this);
        if ($this.children().length > 0) {
            data[$this.prop('tagName')] = xml2json($this);
        } else {
            data[$this.prop('tagName')] = $.trim($this.text());
        }
    });
    return data;
};

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

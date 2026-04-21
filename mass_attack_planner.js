/*
 * Script Name: Mass Attack Planner
 * Version: v1.2.0-custom
 * Last Updated: 2026-04-21
 * Author: RedAlert + custom edit
 * Author URL: https://twscripts.dev/
 * Author Contact: redalert_tw (Discord)
 * Approved: t14001534
 * Approved Date: 2020-06-05
 * Mod: JawJaw
 */

/*--------------------------------------------------------------------------------------
 * This script can NOT be cloned and modified without permission from the script author.
 --------------------------------------------------------------------------------------*/

var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.2.0-custom',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink:
        'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/',
};

// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;

// Local Storage
var LS_PREFIX = `ra_massAttackPlanner_`;
var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30; /* fetch data every 30 days */
var LAST_UPDATED_TIME = parseInt(
    localStorage.getItem(`${LS_PREFIX}_last_updated`) || '0',
    10
);

var unitInfo;

// Init Debug
initDebug();

/* Fetch unit info only when needed */
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

// Script Initializer
function init(unitInfo) {
    var currentDateTime = getCurrentDateTime();

    // fix for no paladin worlds
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
                            <div class="ra-slider-value">
                                <span id="blocked_from_value">00:00</span>
                            </div>
                        </div>
                        <div class="ra-flex-6">
                            <label for="blocked_to_slider">Blocked until</label>
                            <input id="blocked_to_slider" type="range" min="0" max="23" step="1" value="8">
                            <div class="ra-slider-value">
                                <span id="blocked_to_value">08:00</span>
                            </div>
                        </div>
                    </div>

                    <input type="hidden" id="blocked_from" value="00:00">
                    <input type="hidden" id="blocked_to" value="08:00">

                    <small>
                        Example: 00:00 → 08:00 or 01:00 → 09:00.  
                        Intervals crossing midnight also work, e.g. 23:00 → 06:00.
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
                <a id="submit_btn" class="button" onClick="handleSubmit();">Get Plan!</a>
            </div>

            <div class="ra-mb15">
                <label for="results">Results</label>
                <textarea id="results"></textarea>
            </div>
        `;

    const windowContent = prepareWindowContent(content);
    attackPlannerWindow = window.open(
        '',
        '',
        'left=10px,top=10px,width=520,height=760,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0'
    );
    attackPlannerWindow.document.write(windowContent);
    attackPlannerWindow.document.close();
}

// Helper: Window Content
function prepareWindowContent(windowBody) {
    const windowHeader = `<h1 class="ra-fs18 ra-fw600">${scriptData.name}</h1>`;
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
                padding: 15px;
                box-sizing: border-box;
            }
            * { box-sizing: border-box; }
            main { max-width: 768px; margin: 0 auto; }
            h1 { font-size: 27px; margin: 0 0 15px; }
            a { font-weight: 700; text-decoration: none; color: #603000; }
            small { font-size: 10px; line-height: 1.4; display: block; }

            input[type="text"],
            select,
            textarea {
                display: block;
                width: 100%;
                height: auto;
                box-sizing: border-box;
                padding: 5px;
                outline: none;
                border: 1px solid #999;
                background: #fff;
            }

            input[type="text"]:focus,
            select:focus,
            textarea:focus {
                outline: none;
                box-shadow: none;
                border: 1px solid #603000;
                background-color: #eee;
            }

            input[type="range"] {
                width: 100%;
                margin: 8px 0 4px;
            }

            label {
                font-weight: 600;
                display: block;
                margin-bottom: 5px;
                font-size: 12px;
            }

            .ra-inline-label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                cursor: pointer;
            }

            .ra-inline-label input[type="checkbox"] {
                margin: 0;
            }

            textarea {
                width: 100%;
                height: 80px;
                resize: none;
            }

            .ra-mb15 { margin-bottom: 15px; }
            .ra-mt10 { margin-top: 10px; }
            .ra-gap10 { gap: 10px; }

            .ra-flex {
                display: flex;
                flex-flow: row wrap;
                justify-content: space-between;
            }

            .ra-flex-6 { flex: 0 0 48%; }
            .ra-flex-4 { flex: 0 0 31%; }

            .ra-box {
                border: 1px solid #b89b68;
                background: rgba(255,255,255,0.25);
                padding: 10px;
            }

            .ra-slider-value {
                font-weight: 700;
                color: #603000;
                font-size: 12px;
                text-align: center;
                margin-top: 4px;
            }

            .button {
                padding: 10px 20px;
                background-color: #603000;
                font-weight: 500;
                color: #fff;
                text-align: center;
                display: inline-block;
                cursor: pointer;
                text-transform: uppercase;
            }

            @media (max-width: 500px) {
                .ra-flex-6,
                .ra-flex-4 {
                    flex: 0 0 100%;
                }
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

            <script>
                function loadJS(url, callback) {
                    var scriptTag = document.createElement('script');
                    scriptTag.src = url;
                    scriptTag.onload = callback;
                    scriptTag.onreadystatechange = callback;
                    document.body.appendChild(scriptTag);
                }

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

                    if (!fromSlider || !toSlider || !fromValue || !toValue || !fromHidden || !toHidden) {
                        return;
                    }

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

                    if (fromSlider) {
                        fromSlider.addEventListener('input', syncBlockedRangeUI);
                    }

                    if (toSlider) {
                        toSlider.addEventListener('input', syncBlockedRangeUI);
                    }

                    syncBlockedRangeUI();
                }

                loadJS('https://code.jquery.com/jquery-3.6.0.min.js', function() {
                    loadJS('https://palikon.github.io/DK_opevko/attack_planner_helper.js', function() {
                        console.log('Helper libraries loaded!');
                        initBlockedTimeUI();
                    });
                });
            </script>
        </body>
        </html>
    `;

    return html;
}

// Helper: Get and format current datetime
function getCurrentDateTime() {
    let currentDateTime = new Date();

    var currentYear = currentDateTime.getFullYear();
    var currentMonth = currentDateTime.getMonth();
    var currentDate = '' + currentDateTime.getDate();
    var currentHours = '' + currentDateTime.getHours();
    var currentMinutes = '' + currentDateTime.getMinutes();
    var currentSeconds = '' + currentDateTime.getSeconds();

    currentMonth = currentMonth + 1;
    currentMonth = '' + currentMonth;
    currentMonth = currentMonth.padStart(2, '0');

    currentDate = currentDate.padStart(2, '0');
    currentHours = currentHours.padStart(2, '0');
    currentMinutes = currentMinutes.padStart(2, '0');
    currentSeconds = currentSeconds.padStart(2, '0');

    let formatted_date =
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
        currentSeconds;

    return formatted_date;
}

/* Helper: Fetch World Unit Info */
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

// Helper: XML to JSON converter
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

// Helper: Generates script info
function scriptInfo() {
    return `[${scriptData.name} ${scriptData.version}]`;
}

// Helper: Prints universal debug information
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

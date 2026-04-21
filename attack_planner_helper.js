// Credits: b@ldr + custom edit

try {
    var unitInfo;

    jQuery
        .ajax({
            url: '/interface.php?func=get_unit_info',
        })
        .done(function (response) {
            unitInfo = xml2json(jQuery(response));
        });

    function getBlockedTimeSettings() {
        return {
            enabled: jQuery('#exclude_blocked_attacks').is(':checked'),
            from: jQuery('#blocked_from').val() || '00:00',
            to: jQuery('#blocked_to').val() || '08:00',
        };
    }

    function parseTimeToMinutes(timeStr) {
        if (!timeStr || timeStr.indexOf(':') === -1) return null;

        var parts = timeStr.split(':');
        var hours = parseInt(parts[0], 10);
        var minutes = parseInt(parts[1], 10);

        if (
            isNaN(hours) ||
            isNaN(minutes) ||
            hours < 0 ||
            hours > 23 ||
            minutes < 0 ||
            minutes > 59
        ) {
            return null;
        }

        return hours * 60 + minutes;
    }

    function isLaunchTimeBlocked(dateObj, blockedFrom, blockedTo) {
        var fromMinutes = parseTimeToMinutes(blockedFrom);
        var toMinutes = parseTimeToMinutes(blockedTo);

        if (fromMinutes === null || toMinutes === null) {
            return false;
        }

        var currentMinutes = dateObj.getHours() * 60 + dateObj.getMinutes();

        // napr. 01:00 -> 09:00
        if (fromMinutes < toMinutes) {
            return currentMinutes >= fromMinutes && currentMinutes < toMinutes;
        }

        // interval cez polnoc, napr. 23:00 -> 06:00
        if (fromMinutes > toMinutes) {
            return currentMinutes >= fromMinutes || currentMinutes < toMinutes;
        }

        // rovnaký čas = celý deň blokovaný
        return true;
    }

    function isValidArrivalDate(dateString) {
        var date = new Date(dateString);
        return !isNaN(date.getTime());
    }

    function getUniqueCoordsFromTextarea(selector) {
        var raw = jQuery(selector).val() || '';
        var matches = raw.match(/[0-9]{1,3}\|[0-9]{1,3}/g) || [];
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
        var tableInputs = jQuery('.ra-target-count-input');
        var targets = [];

        if (tableInputs.length) {
            tableInputs.each(function () {
                var coord = jQuery(this).attr('data-target');
                if (coord) targets.push(coord);
            });

            return targets.length ? targets : null;
        }

        return getUniqueCoordsFromTextarea('textarea#target_coords');
    }

    function getPerTargetNukeLimits(globalCount, targets) {
        var limits = {};
        var tableInputs = jQuery('.ra-target-count-input');

        // fallback: ak tabuľka neexistuje, všetko ide na global
        if (!tableInputs.length) {
            for (var i = 0; i < targets.length; i++) {
                limits[targets[i]] = globalCount;
            }
            return limits;
        }

        tableInputs.each(function () {
            var coord = jQuery(this).attr('data-target');
            var raw = (jQuery(this).val() || '').trim().toUpperCase();

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

        // ak náhodou niečo v limits chýba
        for (var i = 0; i < targets.length; i++) {
            if (typeof limits[targets[i]] === 'undefined') {
                limits[targets[i]] = globalCount;
            }
        }

        return limits;
    }

    function get_travel_times(attackers, defenders, speed, arrival_time) {
        var travel_times = new Array();
        var blockedSettings = getBlockedTimeSettings();

        for (var i = 0; i < attackers.length; i++) {
            travel_times[attackers[i]] = new Array();

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
        if (typeof targetLimitsOrNumber === 'number') {
            return targetLimitsOrNumber;
        }

        if (
            typeof targetLimitsOrNumber === 'object' &&
            targetLimitsOrNumber !== null
        ) {
            return parseInt(targetLimitsOrNumber[defend] || 0, 10);
        }

        return 0;
    }

    function get_plan(travel_times, targetLimitsOrNumber, type) {
        var plan = new Array();
        var used_targets = new Array();

        for (var attack in travel_times) {
            var fastest = Number.MAX_SAFE_INTEGER;
            var target = '';
            var travel_time = '';
            plan[attack] = new Array();

            for (var defend in travel_times[attack]) {
                if (typeof used_targets[defend] === 'undefined') {
                    used_targets[defend] = 0;
                }

                var currentTargetLimit = getTargetLimit(targetLimitsOrNumber, defend);

                if (currentTargetLimit <= 0) {
                    continue;
                }

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

    function get_troop(type) {
        var unit = '';
        var unitSpeed = '';

        if (type == 'nobel') {
            return '[unit]snob[/unit]';
        } else if (type == 'nuke') {
            unitSpeed = jQuery('select#nuke_unit').val();
        } else if (type == 'support') {
            unitSpeed = jQuery('select#support_unit').val();
        }

        Object.entries(unitInfo.config).map((currentUnit) => {
            if (currentUnit[1].speed === unitSpeed) {
                unit = `[unit]${currentUnit[0]}[/unit]`;

                if (type === 'nuke') {
                    if (currentUnit[0] === 'knight') {
                        unit = `[unit]light[/unit]`;
                    }
                    if (currentUnit[0] === 'archer') {
                        unit = `[unit]axe[/unit]`;
                    }
                    if (currentUnit[0] === 'catapult') {
                        unit = `[unit]ram[/unit]`;
                    }
                } else {
                    if (currentUnit[0] === 'archer') {
                        unit = `[unit]spear[/unit]`;
                    }
                    if (currentUnit[0] === 'light') {
                        unit = `[unit]paladin[/unit]`;
                    }
                    if (currentUnit[0] === 'marcher') {
                        unit = `[unit]paladin[/unit]`;
                    }
                }
            }
        });

        return unit;
    }

    function get_twcode(plan, land_time) {
        var twcode = `[size=12][b]Landing time: ${land_time}[/b][/size]\n\n`;

        if (!plan || !plan.length) {
            return (
                twcode +
                '[b]No valid plans found with the current settings.[/b]'
            );
        }

        var colour = '';

        for (var attack in plan) {
            if (
                plan[attack]['target'] != undefined ||
                plan[attack]['travel_time'] != undefined ||
                plan[attack]['type'] != undefined
            ) {
                if (plan[attack]['type'] == 'nobel') {
                    colour = '#2eb92e';
                } else if (plan[attack]['type'] == 'nuke') {
                    colour = '#ff0e0e';
                } else if (plan[attack]['type'] == 'support') {
                    colour = '#0eaeae';
                }

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
                    '[/color][/b]\n';
            }
        }

        return twcode;
    }

    function merge(array1, array2) {
        for (var element in array2) {
            if (typeof array1[element] === 'undefined') {
                array1[element] = array2[element];
            }
        }
        return array1;
    }

    function clean(clean_me, of_these) {
        if (!clean_me) return null;
        if (!of_these) return clean_me;

        var cleaned = new Array();
        for (var element in clean_me) {
            if (of_these.indexOf(clean_me[element]) == -1) {
                cleaned.push(clean_me[element]);
            }
        }
        return cleaned.length ? cleaned : null;
    }

    function sort(array) {
        var stored_by_time = new Array();
        var sorted = new Array();
        var keys = new Array();
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

        keys.sort(function (a, b) {
            return a - b;
        });

        for (var key in keys) {
            var plan = new Array();
            plan['attacker'] = stored_by_time[keys[key]]['attacker'];
            plan['target'] = stored_by_time[keys[key]]['target'];
            plan['type'] = stored_by_time[keys[key]]['type'];
            plan['travel_time'] = stored_by_time[keys[key]]['travel_time'];
            sorted.push(plan);
        }

        return sorted;
    }

    function handleSubmit() {
        var arrival_time = jQuery('input#arrival_time').val();

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

        var nuke_speed = parseFloat(jQuery('select#nuke_unit').val());
        var support_speed = parseFloat(jQuery('select#support_unit').val());
        var nobel_speed = parseFloat(jQuery('input#nobleSpeed').val());

        var nobel_coords = getUniqueCoordsFromTextarea('textarea#nobel_coords');
        var nuke_coords;
        var support_coords;

        if (nobel_coords == null) {
            nuke_coords = getUniqueCoordsFromTextarea('textarea#nuke_coords');
            if (nuke_coords == null) {
                support_coords = getUniqueCoordsFromTextarea('textarea#support_coords');
            } else {
                support_coords = clean(
                    getUniqueCoordsFromTextarea('textarea#support_coords'),
                    nuke_coords
                );
            }
        } else {
            nuke_coords = clean(
                getUniqueCoordsFromTextarea('textarea#nuke_coords'),
                nobel_coords
            );

            if (nuke_coords == null) {
                support_coords = clean(
                    getUniqueCoordsFromTextarea('textarea#support_coords'),
                    nobel_coords
                );
            } else {
                support_coords = clean(
                    clean(
                        getUniqueCoordsFromTextarea('textarea#support_coords'),
                        nobel_coords
                    ),
                    nuke_coords
                );
            }
        }

        var targets_coords = getTargetsFromTableOrTextarea();

        var nuke_count = parseInt(jQuery('input#nuke_count').val(), 10) || 0;
        var support_count = parseInt(jQuery('input#support_count').val(), 10) || 0;
        var nobel_count = parseInt(jQuery('input#nobel_count').val(), 10) || 0;

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

        var all_plans = new Array();

        jQuery('textarea#target_coords').val(targets_coords.join('\n'));

        if (nobel_coords && nobel_coords.length) {
            var nobleTravelTimes = get_travel_times(
                nobel_coords,
                targets_coords,
                nobel_speed,
                arrival_time
            );
            jQuery('textarea#nobel_coords').val(nobel_coords.join('\n'));
            all_plans = merge(all_plans, get_plan(nobleTravelTimes, nobel_count, 'nobel'));
        }

        if (nuke_coords && nuke_coords.length) {
            var nukeTravelTimes = get_travel_times(
                nuke_coords,
                targets_coords,
                nuke_speed,
                arrival_time
            );
            jQuery('textarea#nuke_coords').val(nuke_coords.join('\n'));
            all_plans = merge(all_plans, get_plan(nukeTravelTimes, nukeTargetLimits, 'nuke'));
        }

        if (support_coords && support_coords.length) {
            var supportTravelTimes = get_travel_times(
                support_coords,
                targets_coords,
                support_speed,
                arrival_time
            );
            jQuery('textarea#support_coords').val(support_coords.join('\n'));
            all_plans = merge(all_plans, get_plan(supportTravelTimes, support_count, 'support'));
        }

        all_plans = sort(all_plans);
        jQuery('textarea#results').val(get_twcode(all_plans, arrival_time));
    }

    function formatDateTime(date) {
        let currentDateTime = new Date(date);

        var currentYear = currentDateTime.getFullYear();
        var currentMonth = currentDateTime.getMonth();
        var currentDate = currentDateTime.getDate();
        var currentHours = '' + currentDateTime.getHours();
        var currentMinutes = '' + currentDateTime.getMinutes();
        var currentSeconds = '' + currentDateTime.getSeconds();

        currentMonth = currentMonth + 1;
        currentMonth = '' + currentMonth;
        currentMonth = currentMonth.padStart(2, '0');

        currentDate = '' + currentDate;
        currentDate = currentDate.padStart(2, '0');

        currentHours = currentHours.padStart(2, '0');
        currentMinutes = currentMinutes.padStart(2, '0');
        currentSeconds = currentSeconds.padStart(2, '0');

        let formatted_date =
            currentDate +
            '/' +
            currentMonth +
            '/' +
            currentYear +
            ' ' +
            currentHours +
            ':' +
            currentMinutes +
            ':' +
            currentSeconds;

        return formatted_date;
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

    // Helper: Convert Seconds to Hour:Minutes:Seconds
    function secondsToHms(timestamp) {
        const hours = Math.floor(timestamp / 60 / 60);
        const minutes = Math.floor(timestamp / 60) - hours * 60;
        const seconds = timestamp % 60;
        const formatted =
            hours.toString().padStart(2, '0') +
            ':' +
            minutes.toString().padStart(2, '0') +
            ':' +
            seconds.toString().padStart(2, '0');
        return formatted;
    }

    // Helper: Calculate distance between 2 villages
    function calculateDistance(villageA, villageB) {
        const x1 = villageA.split('|')[0];
        const y1 = villageA.split('|')[1];

        const x2 = villageB.split('|')[0];
        const y2 = villageB.split('|')[1];

        const deltaX = Math.abs(x1 - x2);
        const deltaY = Math.abs(y1 - y2);

        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        return distance;
    }

    function fnCalculateLaunchTime(source, target, unitSpeed, landingTime) {
        var distance = calculateDistance(target, source);
        var landingTimeObject = new Date(landingTime);

        const msPerSec = 1000;
        const secsPerMin = 60;
        const msPerMin = msPerSec * secsPerMin;

        const unitTime = distance * unitSpeed * msPerMin;

        /* Truncate milli-second portion of the time */
        var launchTime = new Date();
        launchTime.setTime(
            Math.round((landingTimeObject.getTime() - unitTime) / msPerSec) * msPerSec
        );

        return launchTime;
    }
} catch (error) {
    alert('There was an error!\nPlease contact the script author.');
    console.error(error);
}

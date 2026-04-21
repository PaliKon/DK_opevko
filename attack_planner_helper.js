// Credits: b@ldr

try {
	var unitInfo;
	jQuery
		.ajax({
			url: '/interface.php?func=get_unit_info',
		})
		.done(function (response) {
			unitInfo = xml2json(jQuery(response));
		});

	function get_travel_times(attackers, defenders, speed, arrival_time) {
		var travel_times = new Array();

		for (var i = 0; i < attackers.length; i++) {
			attacker = attackers[i].split('|');
			travel_times[attackers[i]] = new Array();
			for (var j = 0; j < defenders.length; j++) {
				defender = defenders[j].split('|');
				distance = calculateDistance(attackers[i], defenders[j]);

				// var currentTravelTime = distance * speed * 60;
				var currentLaunchTime = fnCalculateLaunchTime(attackers[i], defenders[j], speed, arrival_time);
				travel_times[attackers[i]][defenders[j]] = currentLaunchTime.getTime();
			}
		}

		return travel_times;
	}

	function get_plan(travel_times, max_attack, type) {
		console.log(travel_times);
		var plan = new Array();
		var used_targets = new Array();
		for (attack in travel_times) {
			var fastest = 999999999999999999999.0;
			var target = '';
			var travel_time = '';
			plan[attack] = new Array();
			for (defend in travel_times[attack]) {
				0;
				if (typeof used_targets[defend] === 'undefined') {
					used_targets[defend] = 0;
				}
				if (used_targets[defend] < max_attack) {
					if (travel_times[attack][defend] < fastest) {
						target = defend;
						travel_time = travel_times[attack][defend];
						fastest = travel_time;
					}
				}
			}
			if (target != '' && distance != '') {
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

		var colour = '';

		for (attack in plan) {
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

				var formattedDate = launch_time.toString();
				formattedDate = formatDateTime(formattedDate);

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
		for (element in array2) {
			if (typeof array1[element] === 'undefined') {
				array1[element] = array2[element];
			}
		}
		return array1;
	}

	function clean(clean_me, of_these) {
		var cleaned = new Array();
		for (element in clean_me) {
			if (of_these.indexOf(clean_me[element]) == -1) {
				cleaned.push(clean_me[element]);
			}
		}
		return cleaned;
	}

	function sort(array) {
		var stored_by_time = new Array();
		var sorted = new Array();
		var keys = new Array();
		var increment = 0.000000000001;
		for (element in array) {
			if (typeof array[element]['travel_time'] !== 'undefined') {
				if (typeof stored_by_time[array[element]['travel_time']] === 'undefined') {
					var time = array[element]['travel_time'];
				} else {
					var time = array[element]['travel_time'] + increment;
					increment += increment;
				}
				stored_by_time[time] = array[element];
				stored_by_time[time]['attacker'] = element;
			}
		}
		for (element in stored_by_time) {
			keys.push(element);
		}
		keys.sort(function (b, a) {
			return b - a;
		});
		for (key in keys) {
			var plan = new Array();
			(plan['attacker'] = stored_by_time[keys[key]]['attacker']),
				(plan['target'] = stored_by_time[keys[key]]['target']),
				(plan['type'] = stored_by_time[keys[key]]['type']),
				(plan['travel_time'] = stored_by_time[keys[key]]['travel_time']);
			sorted.push(plan);
		}
		return sorted;
	}

	function handleSubmit() {
		var coord_regex = /[0-9]{1,3}\|[0-9]{1,3}/g;

		var arrival_time = jQuery('input#arrival_time').val();

		var nuke_speed = parseFloat(jQuery('select#nuke_unit').val());
		var support_speed = parseFloat(jQuery('select#support_unit').val());
		var nobel_speed = parseFloat(jQuery('input#nobleSpeed').val());

		var nobel_coords = jQuery('textarea#nobel_coords').val().match(coord_regex);

		if (nobel_coords == null) {
			var nuke_coords = jQuery('textarea#nuke_coords').val().match(coord_regex);
			if (nuke_coords == null) {
				var support_coords = jQuery('textarea#support_coords').val().match(coord_regex);
			} else {
				var support_coords = clean(jQuery('textarea#support_coords').val().match(coord_regex), nuke_coords);
			}
		} else {
			var nuke_coords = clean(jQuery('textarea#nuke_coords').val().match(coord_regex), nobel_coords);
			if (nuke_coords == null) {
				var support_coords = clean(jQuery('textarea#support_coords').val().match(coord_regex), nobel_coords);
			} else {
				var support_coords = clean(
					clean(jQuery('textarea#support_coords').val().match(coord_regex), nobel_coords),
					nuke_coords
				);
			}
		}

		var targets_coords = jQuery('textarea#target_coords').val().match(coord_regex);
		var nuke_count = jQuery('input#nuke_count').val();
		var support_count = jQuery('input#support_count').val();
		var nobel_count = jQuery('input#nobel_count').val();

		var all_plans = new Array();

		jQuery('textarea#target_coords').val(targets_coords.join('\n'));
		if (nobel_coords) {
			var nobleTravelTimes = get_travel_times(nobel_coords, targets_coords, nobel_speed, arrival_time);
			jQuery('textarea#nobel_coords').val(nobel_coords.join('\n'));
			all_plans = merge(all_plans, get_plan(nobleTravelTimes, nobel_count, 'nobel'));
		}
		if (nuke_coords) {
			var nukeTravelTimes = get_travel_times(nuke_coords, targets_coords, nuke_speed, arrival_time);
			jQuery('textarea#nuke_coords').val(nuke_coords.join('\n'));
			all_plans = merge(all_plans, get_plan(nukeTravelTimes, nuke_count, 'nuke'));
		}
		if (support_coords) {
			var supportTravelTimes = get_travel_times(support_coords, targets_coords, support_speed, arrival_time);
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
		launchTime.setTime(Math.round((landingTimeObject.getTime() - unitTime) / msPerSec) * msPerSec);

		return launchTime;
	}
} catch (error) {
	alert('There was an error!\nPlease contact the script author.');
	console.error(error);
}

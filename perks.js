// 2>&-; exec node "$0" "$@"

const equipment = {
	shield: [40, 4, 'health'],
	dagger: [40, 2, 'attack'],
	boots: [55, 6, 'health'],
	mace: [80, 3, 'attack'],
	helm: [100, 10, 'health'],
	pole: [140, 4, 'attack'],
	pants: [160, 14, 'health'],
	axe: [230, 7, 'attack'],
	guards: [275, 23, 'health'],
	sword: [375, 9, 'attack'],
	plate: [415, 35, 'health'],
	arbalest: [450, 15, 'attack'],
	gambeson: [500, 60, 'health'],
};

// Cost of the first level of each perk
const base_cost = {
	Looting_II:     100e3,
	Carpentry_II:   100e3,
	Motivation_II:  50e3,
	Power_II:       20e3,
	Toughness_II:   20e3,
	Overkill:       1e6,
	Resourceful:    50e3,
	Coordinated:    150e3,
	Siphonology:    100e3,
	Anticipation:   1000,
	Resilience:     100,
	Meditation:     75,
	Relentlessness: 75,
	Carpentry:      25,
	Artisanistry:   15,
	Range:          1,
	Agility:        4,
	Bait:           4,
	Trumps:         3,
	Pheromones:     3,
	Packrat:        3,
	Motivation:     2,
	Power:          1,
	Toughness:      1,
	Looting:        1,
};

// Cost increment, in percentage of the base cost, for tier II perks
const increment = {Toughness_II: 500, Power_II: 500, Motivation_II: 1e3, Carpentry_II: 10e3, Looting_II: 10e3};

// Maximum levels for perks
let cap;

// Minimum levels for perks
let must;

let perks = Object.keys(base_cost);

function optimize(params) {
	"use strict";

	let {he_left, zone, unlocks, fixed, weight, climb, mod} = params;
	let pack = {};
	
	for (let perk of unlocks)
		pack[perk] = increment[perk] ? pow(10, max(0, floor(log(he_left) / log(100) - 4.2))) : 1;

	// Total bonus from an additive perk. `x` is the percentage from each level.
	const add = (perk, x) => 1 + level[perk] * x / 100;

	// Total bonus from a compounding perk. `x` is the percentage from each level.
	const mult = (perk, x) => pow(1 + x / 100, level[perk]);

	const corruption_start = 181;
	const max_tiers = zone / 5 + ((zone - 1) % 10 < 5);

	function equip(stat) {
		let {cost, cost_exp, value, value_exp} = equip_total[stat];
		let scaled_income = income() * trimps() / (cost * mult('Artisanistry', -5));
		let levels = 1.136;
		let tiers = log(1 + scaled_income * (cost_exp - 1)) / log(cost_exp);

		if (tiers > max_tiers + 0.45) {
			levels = log(1 + pow(cost_exp, tiers - max_tiers) * 0.2) / log(1.2);
			tiers = max_tiers;
		}
		return value * levels * pow(value_exp, tiers);
	}

	// Amount of Helium awarded at the end of the given zone.
	function zone_helium(z) {
		let level = (z - 19) * 1.35;
		let base = z >= corruption_start ? 10 : z >= 59 ? 5 : 1;
		let reward = round(base * pow(1.23, sqrt(level))) + round(base * level);
		return reward * pow(scientist_done ? 1.005 : 1, z);
	}

	// Total helium from a run up to the given zone
	function run_helium(z) {
		let result = 10 * zone_helium(zone);
		for (let i = 21; i <= z; ++i) {
			let corrupt = floor((i - corruption_start) / 3);
			corrupt = corrupt < 0 ? 0 : min(corrupt + 2, 80);
			result += zone_helium(i) * ((i == 200 ? 20 : 1) + corrupt * 0.15);
		}
		return result;
	}

	// Compute the current cost of a perk, based on its current level.
	function cost(perk) {
		if (increment[perk])
			return pack[perk] * (base_cost[perk] + increment[perk] * (level[perk] + (pack[perk] - 1) / 2));
		else
			return ceil(level[perk] / 2 + base_cost[perk] * mult(perk, 30));
	}

	// Max population
	function trimps() {
		let carp = mult('Carpentry', 10) * add('Carpentry_II', 0.25);
		let bonus = 3 + max(log(income() / base_income * carp / mult('Resourceful', -5)), 0);
		let territory = add('Trumps', 20) * zone;
		return 10 * (base_housing * bonus + territory) * carp * imp.taunt + mod.dg * carp;
	}

	// Number of ticks it takes to one-shot an enemy.
	function ticks() {
		return 1 + (level.Agility < 3) + ceil(10 * mult('Agility', -5));
	}

	// Number of buildings of a given kind that can be built with the current income.
	// cost: base cost of the buildings
	// exp: cost increase for each new level of the building
	function building(cost, exp) {
		cost *= 4 * mult('Resourceful', -5);
		return log(1 + income(true) * trimps() * (exp - 1) / cost) / log(exp);
	}

	const moti = () => add('Motivation', 5) * add('Motivation_II', 1);
	const looting = () => add('Looting', 5) * add('Looting_II', 0.25);

	function income(ignore_prod) {
		let storage = mod.storage * mult('Resourceful', -5) / add('Packrat', 20);
		let loot = looting() * imp.magn / ticks();
		let prod = ignore_prod ? 0 : moti() * add('Meditation', 1) * mod.prod;
		let chronojest = mod.chronojest * 0.75 * prod * loot;
		return base_income * (prod + loot * mod.loot + chronojest) * (1 - storage);
	}

	// function mancers() {
		// let tributes = building(10000, 1.05);
		// let mancers = log(loot * pow(1.05, tributes) / 1e62) / log(1.01);
		// return magma() ? 1 + 0.6 * (1 - pow(0.9999, mancers)) : 1;
	// }

	// Breed speed
	function breed() {
		let nurseries = building(2e6, 1.06) / (1 + 0.1 * min(magma(), 20));
		let potency = 0.00085 * pow(1.1, floor(zone / 5));
		let traps = zone <= 90 ? add('Bait', 100) * mod.breed_timer / trimps() : 0;
		return potency * pow(1.01, nurseries) * add('Pheromones', 10) * imp.ven + traps;
	}

	function group_size(ratio) {
		let result = 1;
		for (let i = 0; i < 20; ++i)
			result = ceil(result * ratio);
		return result / pow(ratio, 20);
	}

	// Theoretical fighting group size (actual size is lower because of Coordinated) 
	function soldiers() {
		let ratio = 1 + 0.25 * pow(0.98, level.Coordinated);
		let coords = log(trimps() / 3 / group_size(ratio)) / log(ratio);
		let available = zone - 1 + (magma() ? 100 : 0);
		return group_size(1.25) * pow(1.25, min(coords, available));
	}

	function breed_factor() {
		let ratio = 1 + 0.25 * pow(0.98, level.Coordinated);
		let available = zone - 1 + (magma() ? 100 : 0);
		let required = group_size(ratio) * pow(ratio, available);
		let fighting = min(required / trimps(), 1 / 3);
		return 0.5 / (0.5 - fighting);
	}

	// Number of zones spent in the Magma
	function magma() {
		return max(zone - 229, 0);
	}

	// Total attack
	function attack() {
		let attack = (6 + equip('attack')) * add('Power', 5) * add('Power_II', 1);
		attack *= add('Relentlessness', 5 * add('Relentlessness', 30));
		attack *= pow(1 + level.Siphonology, 0.1) * add('Range', 1);
		attack *= add('Anticipation', 6);
		attack *= pow(0.8, magma());
		return soldiers() * attack;
	}

	// Block per imp
	// TODO handle shieldblock
	function block() {
		let gyms = building(400, 1.185);
		let trainers = (gyms * log(1.185) - log(1 + gyms)) / log(1.1) + 25 - mystic;
		return 6 * gyms * pow(1 + mystic / 100, gyms) * (1 + tacular * trainers);
	}

	// Total survivability (accounts for health and block)
	function health() {
		let health = (50 + equip('health')) * add('Toughness', 5) * add('Toughness_II', 1);
		health *= mult('Resilience', 10);
		if (!weight.breed) {
			let target_speed = (pow(breed_factor(), 0.1 / mod.breed_timer) - 1) * 10;
			let geneticists = log(breed() / target_speed) / -log(0.98);
			health *= pow(1.01, geneticists);
		}
		health *= pow(0.8, magma());
		return soldiers() * min(health / 60 + block(), health / 12);
	}

	function agility() {
		return 1 / mult('Agility', -5);
	}

	function helium() {
		return base_helium * looting() + 45;
	}

	const overkill = () => level.Overkill ? level.Overkill : 0.5;

	const stats = { agility, helium, attack, health, overkill, breed };

	function score() {
		let result = 0;
		for (let i in weight) {
			if (!weight[i])
				continue;
			let stat = stats[i]();
			if (!isFinite(stat))
				throw Error(i + ' is ' + stat);
			result += weight[i] * log(stat);
		}

		return result;
	}

	function best_perk() {
		let best;
		let max = 0;
		let baseline = score();

		for (let perk of unlocks) {
			if (capped(perk) || cost(perk) > he_left)
				continue;
			if (level[perk] < must[perk])
				return perk;

			level[perk] += pack[perk];
			let gain = score() - baseline;
			level[perk] -= pack[perk];

			let efficiency = gain / cost(perk);
			if (efficiency > max) {
				max = efficiency;
				best = perk;
			}
		}

		return best;
	}

	function compare(a, b) {
		let tmp = score();
		++level[a];
		let a_gain = score() - tmp;
		--level[a];
		++level[b];
		let b_gain = score() - tmp;
		--level[b];
		console.log(a, '=', a_gain / b_gain, b);
	}

	let level = {};
	for (let perk of perks)
		level[perk] = 0;

	cap = {Range: 10, Agility: 20, Relentlessness: 10, Meditation: 7, Anticipation: 10, Siphonology: 3, Overkill: 30};
	must = {};

	for (let perk in fixed)
		cap[perk] = must[perk] = fixed[perk];

	function capped(perk) {
		return cap[perk] && level[perk] >= cap[perk];
	}

	let imp = {};
	for (let name of ['whip', 'magn', 'taunt', 'ven'])
		imp[name] = pow(1.003, zone * 99 * 0.03 * mod[name]);

	let scientist_done = zone > 130;
	let slow = zone > 130;
	let frugal_done = zone > 100 ? 1.28 : 1.2;
	let books = pow(1.25, zone) * pow(frugal_done, max(zone - 59, 0));
	let gigas = max(0, min(zone - 60, zone/2 - 25, zone/3 - 12, zone/5, zone/10 + 17, 39));
	let base_housing = pow(1.25, min(zone / 2, 30) + gigas);
	let mystic = floor(min(zone >= 25 && zone / 5, 9 + zone / 25, 15));
	let tacular = (20 + zone - zone % 5) / 100;
	let base_income = 600 * imp.whip * books;
	let base_helium = run_helium(zone);

	mod.loot *= 20.8 * (0.7 + 0.3 * floor((zone + 1) / 101));
	weight.breed = zone < 70 ? weight.health : 0;
	weight.agility = 5;

	// Precompute equipment ratios
	const equip_total = {
		attack: {cost: 0, cost_exp: 0, value: 0, value_exp: 13},
		health: {cost: 0, cost_exp: 0, value: 0, value_exp: 14},
	};

	for (let piece in equipment) {
		let [cost, value, stat] = equipment[piece];
		equip_total[stat].cost += cost;
		equip_total[stat].value += value;
		if (piece == climb)
			break;
	}

	for (let stat in equip_total) {
		equip_total[stat].value_exp = pow(1.19, equip_total[stat].value_exp);
		equip_total[stat].cost /= pow(1.069, 0.55);
		equip_total[stat].cost_exp = pow(1.069, 0.85 * (zone < 60 ? 57 : 53));
	}

	// Main loop
	let free = {Bait: 1e7, Packrat: 1e7, Trumps: 1e8, Pheromones: 1e6, Resourceful: 1e6};
	let best;

	while ((best = best_perk())) {
		let spent = 0;
		while (!capped(best) && spent < he_left / (free[best] || 1e4)) {
			he_left -= cost(best);
			spent += cost(best);
			level[best] += pack[best];
			if (level[best] == 1000 * pack[best])
				pack[best] *= 10;
		}
	}

	for (let perk in level)
		console.log(perk + ': ' + level[perk]);

	return level;
}

// When executing from the command-line
if (typeof window === 'undefined') {
	console.log(optimize({
		he_left: parseFloat(process.argv[2]),
		zone: 50,
		weight: {helium: 5, attack: 4, health: 2, overkill: 0},
		climb: 'plate',
		unlocks: perks,
		mod: {
			storage: 0.125,
			whip: true,
			magn: true,
			taunt: true,
			ven: true,
			chronojest: 5,
			breed_timer: 30,
		}
	}));
}

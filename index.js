const stateData = {
  qs: 17,
  qs_min: 1,
  qs_max: 100,

  utilization: 17,
  current_unit_cost: 0,
  unit_margin: 0,

  days: 1,
  capital: 50000,
  profit: 0,

  marginal_cost: 22,
  base_cost: 3800,
  fixed_cost: 5000,

  choke_price: 5000,
  qd_slope: 20,

  market_price: 4300,

  player_desirability: 1,// TODO: factor these out into different fields like efficiency and speed

  market_share: 50,

  competitor_base_cost: 3800,
  competitor_desirability: 1.0,
  competitor_price: 4300,
  competitor_tech_step: 0, 
  competitor_aggression: 0.05, // How fast they react to you

  day_last_event: 0,

  factory_upgrade_cost: 25000,
  better_materials_cost: 50000,
  better_cars_cost: 100000,
  bigger_factory_cost: 1000000,

  data_history: 50,
  share_history: []
};

const moneyKeys = [
  'capital', 'profit', 'marginal_cost', 'base_cost', 'fixed_cost', 
  'choke_price', 'market_price',
  'competitor_base_cost', 'competitor_price',
  'factory_upgrade_cost', 'better_materials_cost', 'better_cars_cost', 'bigger_factory_cost'
];

let update_graphs;

// state updaters
const state = new Proxy(stateData, {
  set(target, prop, value) {
    let lim;
    // 1. Clamping Logic
    if (lim = target[prop + "_min"]) value = Math.max(value, lim);
    if (lim = target[prop + "_max"]) value = Math.min(value, lim);
    
    target[prop] = value;

    // 2. Find ALL elements bound to this property
    const elements = document.querySelectorAll(`[data-bind="${prop}"]`);
    
    if (elements.length > 0) {
      // 3. Determine Display Formatting
      let displayValue = value;
      
      if (typeof value === 'number') {
        if (moneyKeys.includes(prop)) {
          // Use LocaleString for commas + 2 decimal places
          displayValue = value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        } else {
          // For non-money numbers (like days or share), just round to 2 decimals
          displayValue = Math.round(value * 100) / 100;
        }
      }

      // 4. Update every instance found in the DOM
      elements.forEach(el => {
        if (el.tagName === 'INPUT') {
          // Inputs usually don't want commas for parsing reasons
          el.value = typeof value === 'number' ? value.toFixed(2) : value;
        } else {
          el.textContent = displayValue;
        }
      });
    }

    // 5. Refresh Visuals
    if (typeof update_graphs === 'function') {
      update_graphs();
    }
    
    return true;
  }
});
const init_data_binds = () => {
  Object.keys(state).forEach(key => {
    state[key] = state[key]; 
  });
};

document.addEventListener('blur', (e) => {
  const prop = e.target.dataset.bind;
  if (prop) {
    const newValue = parseInt(e.target.textContent);
    
    if (newValue && !isNaN(newValue)) {
      state[prop] = newValue;
    }
  }
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset.bind) {
    e.preventDefault(); 
    e.target.blur();
  }
});
// end state updaters

const save_game = () => {
  const dataString = JSON.stringify(stateData);
  localStorage.setItem("market_moves_save", dataString);
  console.log("Game Saved!");
};

const load_game = () => {
  const savedData = localStorage.getItem("market_moves_save");
  if (savedData) {
    const parsed = JSON.parse(savedData);
    
    Object.keys(parsed).forEach(key => {
      state[key] = parsed[key];
    });
    
    console.log("Game Loaded!");
    return true;
  }
  return false;
};

cost = (qs) => {
  if (qs < state.qs_min || qs > state.qs_max) return;
  return state.base_cost + state.marginal_cost * qs;
};

total_cost = (qs) => {
  return state.fixed_cost + (state.base_cost * qs) + (0.5 * state.marginal_cost * Math.pow(qs, 2));
};

price = (qd) => {
  if (qd < state.qs_min || qd > state.qs_max) return;
  qd = qd / (state.market_share / 100);
  return state.choke_price - qd * state.qd_slope;
};

competitor_price = (qd) => {
  if (qd < state.qs_min || qd > state.qs_max) return;
  qd = qd / (1 - state.market_share / 100);
  return state.choke_price - qd * state.qd_slope;
}

get_qd = (price) => {
  return (state.market_share / 100) * (price - state.choke_price) / (-state.qd_slope);
};

get_competitor_qd = (price) => {
  return (1 - state.market_share / 100) * (price - state.choke_price) / (-state.qd_slope);
}

attractiveness = (price) => {
  return Math.pow(1 / (price + 1), 3.0); // TODO: multiplier for attractiveness
};

increment_qs = () => {
  state.qs += Math.pow(10, Math.max(0, Math.floor(Math.log10(state.qs)) - 1));
}
decrement_qs = () => {
  state.qs -= Math.pow(10, Math.max(0, Math.floor(Math.log10(state.qs-1)) - 1));
}

upgrade_factory = () => {
  if (state.capital < state.factory_upgrade_cost) return;
  state.marginal_cost *= 0.9;
  state.capital -= state.factory_upgrade_cost;
  state.factory_upgrade_cost *= 2;
}

better_materials = () => {
  if (state.capital < state.better_materials_cost) return;
  state.base_cost *= 0.99;
  state.capital -= state.better_materials_cost;
  state.better_materials_cost *= 1.5;
}

better_cars = () => {
  if (state.capital < state.better_cars_cost) return;
  state.base_cost *= 1.01;
  state.player_desirability *= 1.15;
  state.capital -= state.better_cars_cost;
  state.better_cars_cost *= 2;
}

bigger_factory = () => {
  if (state.capital < state.bigger_factory_cost) return;
  state.fixed_cost *= 1.5;
  state.qs_max *= 1.5;
  state.qs_max = Math.round(state.qs_max);
  state.capital -= state.bigger_factory_cost;
  state.bigger_factory_cost *= 3;
}

profit = (qs) => {
  let quantity_sold = Math.max(0, Math.min(qs, get_qd(state.market_price)));

  let production_cost = total_cost(qs);
  let revenue = state.market_price * quantity_sold;
  return revenue - production_cost;
}

update_graphs = () => {
  document.querySelector("#quantity-graph").innerHTML = "";
  document.querySelector("#profit-graph").innerHTML = "";
  document.querySelector("#share-graph").innerHTML = "";
  
  let domain_min = state.qs_min;
  let domain_max = state.qs_max;

  let range_min = Math.min(price(domain_max), cost(domain_min));
  let range_max = Math.max(price(domain_min), cost(domain_max));

  let domain_size = domain_max - domain_min;
  let range_size = range_max - range_min;

  let domain_nudge = 0.1 * domain_size;
  let range_nudge = 0.1 * range_size;

  functionPlot({
    title: 'Supply/Demand Curve',
    target: '#quantity-graph',
    disableZoom: true,
    grid: true,
    xAxis: {
      label: "Quantity (cars/day)",
      domain: [domain_min - domain_nudge, domain_max + domain_nudge]
    },
    yAxis: {
      label: "Market Cost ($/car)",
      domain: [range_min - range_nudge, range_max + range_nudge]
    },
    tip: {
      xLine: true,
      yLine: true
    },
    data: [
      {
        fn: (scope) => { return cost(scope.x); },
        sampler: 'builtIn', // smooth curve
        graphType: 'polyline',
        color: 'var(--foreground-primary)'
      },
      {
        fn: (scope) => { return price(scope.x); },
        sampler: 'builtIn',
        graphType: 'polyline',
        color: 'var(--foreground-primary)'
      },
      {
        fn: (scope) => { return competitor_price(scope.x); },
        sampler: 'builtIn',
        graphType: 'polyline',
        color: 'var(--foreground-secondary)'
      },
    ],
    annotations: [
      {
        x: state.qs, 
      },
      {
        y: state.market_price,
      }
    ]
  });


  functionPlot({
    title: 'Profit Curve',
    target: '#profit-graph',
    disableZoom: true,
    grid: true,
    xAxis: {
      label: "Quantity (cars/day)",
      domain: [state.qs_min, state.qs_max]
    },
    yAxis: {
      label: "Profit ($)",
      domain: [Math.min(0, profit(state.qs)*1.2), Math.max(1, profit(state.qs)*1.2)]
    },
    tip: {
      xLine: true,
      yLine: true
    },
    data: [
      {
        fn: (scope) => { return profit(scope.x); },
        sampler: 'builtIn', // smooth curve
        graphType: 'polyline',
        color: 'var(--foreground-primary)'
      },
    ],
    annotations: [
      {
        x: state.qs, 
      },
      {
        y: profit(state.qs)
      }
    ]
  });

  
  functionPlot({
    title: 'Market Share',
    target: '#share-graph',
    disableZoom: true,
    grid: true,
    xAxis: {
      label: "Day",
      domain: [state.days-state.data_history, state.days]
    },
    yAxis: {
      label: "Market Share (%)",
      domain: [0, 100]
    },
    tip: {
      xLine: true,
      yLine: true
    },
    data: [
      {
        points: state.share_history,
        fnType: 'points',
        sampler: 'builtIn', // smooth curve
        graphType: 'polyline',
        color: 'var(--foreground-primary)'
      },
    ],
    annotations: [
      {
        y: 50
      }
    ]
  });
};

sanitize = (point) => {
  let x = point.x;
  if (isNaN(x)) x = 0;
  let y = point.y;
  if (isNaN(y)) y = 0;
  return { x: x, y: y };
}

log_data = () => {
  state.share_history.push([state.days, state.market_share]);

  if (state.share_history.length > state.data_history) {
    state.share_history.shift();
  }
};

do_production = () => {
  state.profit = profit(state.qs);
  state.capital += state.profit;
};

update_market_share = () => {
  let player_attr = attractiveness(state.market_price) * state.player_desirability;
  let comp_attr = attractiveness(state.competitor_price) * state.competitor_desirability;

  state.market_share = Math.floor((player_attr / (player_attr + comp_attr)) * 100);
};

modal = (title, message) => {
  document.querySelector("#dialog h2").textContent = title;
  document.querySelector("#dialog p").textContent = message;

  document.querySelector("#dialog").showModal();
};

run_competitor_ai = () => {

  // 1. Reactive Pricing: They want to be within 5% of your 'Value'
  const player_value = state.market_price * state.player_desirability;
  const comp_value = state.competitor_price * state.competitor_desirability;

  console.log(player_value, comp_value);

  if (comp_value > player_value * 1.05) {
    state.competitor_price -= 20; // You're a better deal, they drop price to compete
  } else if (comp_value < player_value * 0.95) {
    state.competitor_price += 10; // They are undercutting you too much, they raise price for profit
  }

  // 2. Simulated Growth: If they have > 40% share, they 'reinvest'
  if (state.market_share < 60) { // Player has < 60, so AI has > 40
    state.competitor_tech_step += 1;
    if (state.competitor_tech_step >= 50) { // Every 50 ticks of success, they 'upgrade'
      state.competitor_desirability += 0.05;
      state.competitor_base_cost *= 0.95; 
      state.competitor_tech_step = 0;
      modal("Competition update!", "Competitor has upgraded their production.");
    }
  }

  // 3. Floor: They won't commit suicide by pricing below cost
  competitor_qd = Math.min(state.qs_max, Math.max(1, get_competitor_qd(state.competitor_price)));
  state.competitor_price = Math.max(state.competitor_price, 0.5 * state.marginal_cost * competitor_qd + state.competitor_base_cost + state.fixed_cost / competitor_qd);
};

update_button_states = () => {
  const upgrades = [
    { fn: "upgrade_factory()", cost: state.factory_upgrade_cost },
    { fn: "better_materials()", cost: state.better_materials_cost },
    { fn: "better_cars()", cost: state.better_cars_cost },
    { fn: "bigger_factory()", cost: state.bigger_factory_cost }
  ];

  upgrades.forEach(upgrade => {
    // Select the button by its onclick attribute
    const btn = document.querySelector(`button[onclick="${upgrade.fn}"]`);
    if (btn) {
      if (state.capital >= upgrade.cost) {
        btn.classList.remove('is-disabled');
      } else {
        btn.classList.add('is-disabled');
      }
    }
  });
};

update_display_values = () => {
  state.utilization = state.qs / state.qs_max;

  state.current_unit_cost = total_cost(state.qs) / Math.max(1, state.qs);
  state.unit_margin = state.market_price - state.current_unit_cost;
}

do_increased_population = () => {
  modal("Population increased!", "More people move to your area, demand slope decreases.");
  state.qd_slope *= 0.8;
};

do_new_development = () => {
  modal("New Development!", "New houses are built in your area, choke price increases.");
  state.choke_price *= 1.05;
}

const world_events = [
  { weight: 1.0, fn: do_increased_population },
  { weight: 1.0, fn: do_new_development },
];

do_event = () => {
  if (Math.random() < 0.1 && (state.days - state.day_last_event) > 30) {
    console.log("Doing event...");
    state.day_last_event = state.days;

    const total_weight = world_events.reduce((sum, event) => sum + event.weight, 0);

    let random = Math.random() * total_weight;
  
    for (const event of world_events) {
      if (random < event.weight) {
        event.fn();
        break;
      }

      random -= event.weight;
    }
  }
};

const requantize = () => {

  moneyKeys.forEach(key => {
    if (typeof stateData[key] === 'number') {
      // Rounds to 2 decimal places (cents)
      stateData[key] = Math.round(stateData[key] * 100) / 100;
    }
  });
};

game_loop = () => {
  state.days++;
  do_event();
  run_competitor_ai();
  update_market_share();
  do_production();
  log_data();
  update_graphs();
  update_button_states();
  update_display_values();

  requantize();

  save_game();
};

start_game = () => {
  setInterval(game_loop, 2000);
}

window.onload = () => {
  init_data_binds();

  const has_save = load_game();
  //const has_save = false;

  update_graphs();
  
  game_loop();

  if (!has_save) {
    const startDialog = document.querySelector("#dialog");

    startDialog.addEventListener('close', () => {
      start_game(); 
    }, { once: true });

    startDialog.showModal();
  } else {
    start_game();
  }
};

reset_game = () => {
  localStorage.removeItem("market_moves_save");
  window.location.reload();
}

reset_game_msg = () => {
  let el = document.querySelector("#reset");

  el.textContent = "PRESS AGAIN";
  el.onclick = reset_game;

  setTimeout(() => {
    el.textContent = "RESET";
    el.onclick = reset_game_msg;
  }, 1000);
}

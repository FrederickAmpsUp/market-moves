const stateData = {
  qs: 20,
  qs_min: 1,
  qs_max: 100,

  days: 1,
  capital: 50000,

  marginal_cost: 22,
  base_cost: 3800,
  fixed_cost: 8000,

  choke_price: 5000,
  qd_slope: 20,

  market_price: 3000,

  factory_upgrade_cost: 25000,
  better_materials_cost: 50000,

  data_history: 50,
  price_history: [],
  profit_history: []
};

let update_supply_graph;

// state updaters
const state = new Proxy(stateData, {
  set(target, prop, value) {
    let lim;
    if (lim = target[prop + "_min"]) {
      value = Math.max(value, lim);
    }
    if (lim = target[prop + "_max"]) {
      value = Math.min(value, lim);
    }
    
    target[prop] = value;

    const el = document.querySelector(`[data-bind="${prop}"]`);
    if (el) {
      if (el.tagName === 'INPUT') el.value = value;
      else el.textContent = value;
    }

    update_supply_graph();
    
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
  return state.choke_price - qd * state.qd_slope;
};

get_qd = (price) => {
  return (price - state.choke_price) / (-state.qd_slope);
};

increment_qs = () => {
  state.qs += Math.pow(10, Math.floor(Math.log10(state.qs)));
}
decrement_qs = () => {
  state.qs -= Math.pow(10, Math.floor(Math.log10(state.qs-1)));
}

upgrade_factory = () => {
  state.marginal_cost *= 0.9;
  state.capital -= state.factory_upgrade_cost;
  state.factory_upgrade_cost *= 2;
}

better_materials = () => {
  state.base_cost *= 0.99;
  state.capital -= state.better_materials_cost;
  state.better_materials_cost *= 1.5;
}

profit = (qs) => {
  let quantity_sold = Math.max(0, Math.min(qs, get_qd(state.market_price)));

  let production_cost = total_cost(qs);
  let revenue = state.market_price * quantity_sold;
  return revenue - production_cost;
}

update_supply_graph = () => {
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
      },
      {
        fn: (scope) => { return price(scope.x); },
        sampler: 'builtIn',
        graphType: 'polyline'
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
      domain: [0, 20000]
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
      },
    ],
    annotations: [
      {
        x: state.qs, 
      },
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
  state.price_history.push(sanitize({ x: state.days, y: state.market_price }));
  state.profit_history.push(sanitize({ x: state.days, y: profit(state.qs) }));

  if (state.price_history.length > state.data_history) {
    state.price_history.shift();
    state.profit_history.shift();
  }

  functionPlot({
    title: 'Market Trends (Last 50 Days)',
    target: '#history-graph',
    disableZoom: true,
    grid: true,
    xAxis: {
      label: "Day",
      domain: [Math.max(1, state.days - state.data_history), state.days + 1]
    },
    yAxis: {
      label: "Value ($)",
      domain: [-1000, 1.5 * state.market_price]
    },
    data: [
      {
        points: state.price_history.map(d => [d.x, d.y]),
        fnType: 'points',
        graphType: 'polyline',
        color: 'cyan'
      },
      {
        points: state.profit_history.map(d => [d.x, d.y]),
        fnType: 'points',
        graphType: 'polyline',
        color: 'green'
      }
    ],
    annotations: [
      {
        y: 0
      }
    ]
  });
};

update_market_price = () => {
  state.market_price = price(state.qs);
  state.market_price += Math.round(0.01 * state.market_price * (Math.random() * 2.0 - 1.0));
};

do_production = () => {
  state.capital += profit(state.qs);
};

game_loop = () => {
  state.days++;
  update_market_price();
  do_production();
  update_supply_graph();
  log_data();

  state.capital = Math.round(state.capital);

  save_game();
};

start_game = () => {
  setInterval(game_loop, 2000);
}

window.onload = () => {
  init_data_binds();

  const has_save = load_game();

  update_supply_graph();
  
  state.price_history = [{x: 0, y: state.market_price}];
  state.profit_history = [{x: 0, y: 0}];

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

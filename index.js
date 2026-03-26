const stateData = {
  qs: 1,
  qs_min: 1,
  qs_max: 1,

  capital: 500,

  marginal_cost: 0.2,
  base_cost: 1,
  fixed_cost: 5
};

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
    
    return true;
  }
});

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

cost = (qs) => {
  if (qs < state.qs_min || qs > state.qs_max) return;
  return state.fixed_cost + state.base_cost * qs + state.marginal_cost * qs * qs;
};

increment_qs = () => {
  state.qs += Math.pow(10, Math.floor(Math.log10(state.qs)));
}
decrement_qs = () => {
  state.qs -= Math.pow(10, Math.floor(Math.log10(state.qs-1)));
}

update_supply_graph = () => {
  let domain_min = state.qs_min;
  let domain_max = state.qs_max;

  let range_min = cost(domain_min);
  let range_max = cost(domain_max);

  let domain_size = domain_max - domain_min;
  let range_size = range_max - range_min;

  let domain_nudge = 0.1 * domain_size;
  let range_nudge = 0.1 * range_size;

  functionPlot({
    title: 'Supply Curve',
    target: '#supply-graph',
    disableZoom: true,
    grid: true,
    xAxis: {
      label: "Quantity Supplied (cars/day)",
      domain: [domain_min - domain_nudge, domain_max + domain_nudge]
    },
    yAxis: {
      label: "Market Cost",
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
      }
    ],
    annotations: [
      {
        x: state.qs, 
      }
    ]
  });


};

game_loop = () => {

  requestAnimationFrame(game_loop);
};

window.onload = () => {
  state.qs = 1;
  state.qs_max = 100;
  state.capital = 500;

  update_supply_graph();
  requestAnimationFrame(game_loop);
};

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/script4.ts
var import_uuid = require("uuid");
var import_axios = __toESM(require("axios"));
var DeliveryPoint = class {
  constructor({
    id,
    x,
    y,
    demand
  }) {
    this.id = id || (0, import_uuid.v4)();
    this.x = x;
    this.y = y;
    this.demand = demand;
  }
};
var Depot = class extends DeliveryPoint {
  constructor({
    id,
    x,
    y
  }) {
    super({ id, x, y, demand: 0 });
  }
};
var Vehicle = class {
  constructor({
    id,
    capacity,
    currentLoad = 0
  }) {
    this.id = id || (0, import_uuid.v4)();
    this.capacity = capacity;
    this.currentLoad = currentLoad;
  }
  // Reseta a carga do veículo ao retornar ao depósito
  resetLoad() {
    this.currentLoad = 0;
  }
  // Verifica se o veículo pode carregar uma demanda específica
  canLoad(demand) {
    return this.currentLoad + demand <= this.capacity;
  }
  // Carrega um ponto de entrega
  load(demand) {
    if (!this.canLoad(demand)) {
      throw new Error(`Ve\xEDculo ${this.id} n\xE3o pode carregar ${demand}`);
    }
    this.currentLoad += demand;
  }
};
var RoutePlanner = class {
  constructor({ depot, deliveryPoints, rclSize }) {
    this.distanceMatrix = {};
    this.depot = depot;
    this.deliveryPoints = deliveryPoints;
    this.rclSize = rclSize || 3;
  }
  // Método para executar a estratégia definida
  planRoutes(vehicle) {
    return this.strategy(vehicle);
  }
  // Método para definir a estratégia de roteamento
  setStrategy(strategy) {
    const mapper = {
      "greedy": this.planRoutesGreedy,
      "randomized": this.planRoutesWithRandomization
    };
    this.strategy = mapper[strategy];
    console.log("Estrat\xE9gia definida:", strategy);
  }
  // Constrói a matriz de distâncias usando Valhalla
  buildDistanceMatrix(valhallaUrl) {
    return __async(this, null, function* () {
      const allPoints = [this.depot, ...this.deliveryPoints];
      this.distanceMatrix = {};
      for (const from of allPoints) {
        this.distanceMatrix[from.id] = {};
        for (const to of allPoints) {
          if (from.id !== to.id) {
            const distance = yield this.fetchDistance(valhallaUrl, from, to);
            this.distanceMatrix[from.id][to.id] = distance;
          }
        }
      }
      console.log("Matriz de dist\xE2ncias constru\xEDda:", this.distanceMatrix);
    });
  }
  // Busca a distância entre dois pontos via Valhalla
  fetchDistance(valhallaUrl, from, to) {
    return __async(this, null, function* () {
      const response = yield import_axios.default.post(`${valhallaUrl}/route`, {
        locations: [
          { lat: from.y, lon: from.x },
          { lat: to.y, lon: to.x }
        ],
        costing: "auto",
        directions_options: { units: "kilometers" }
      });
      const route = response.data.trip;
      if (route && route.legs.length > 0) {
        return route.legs[0].summary.length;
      } else {
        throw new Error("Rota n\xE3o encontrada");
      }
    });
  }
  // Gera as rotas considerando a capacidade do veículo
  planRoutesGreedy(vehicle) {
    const allPoints = [this.depot, ...this.deliveryPoints];
    const unvisited = new Set(this.deliveryPoints.map((p) => p.id));
    const routes = [];
    let totalDistance = 0;
    while (unvisited.size > 0) {
      const currentRoute = [this.depot];
      let currentLocation = this.depot.id;
      let routeDistance = 0;
      vehicle.resetLoad();
      while (unvisited.size > 0) {
        let nearestNeighbor = null;
        let shortestDistance = Infinity;
        for (const neighbor of unvisited) {
          const demand = allPoints.find((p) => p.id === neighbor).demand;
          if (vehicle.canLoad(demand)) {
            const distance = this.distanceMatrix[currentLocation][neighbor];
            if (distance < shortestDistance) {
              shortestDistance = distance;
              nearestNeighbor = neighbor;
            }
          }
        }
        if (nearestNeighbor === null) break;
        const nextLocation = nearestNeighbor;
        const nextPoint = allPoints.find((p) => p.id === nextLocation);
        vehicle.load(nextPoint.demand);
        currentRoute.push(nextPoint);
        routeDistance += this.distanceMatrix[currentLocation][nextLocation];
        unvisited.delete(nextLocation);
        currentLocation = nextLocation;
      }
      routeDistance += this.distanceMatrix[currentLocation][this.depot.id];
      currentRoute.push(this.depot);
      routes.push(currentRoute);
      totalDistance += routeDistance;
    }
    return { routes, totalDistance };
  }
  // Estratégia com seleção aleatória entre os melhores candidatos (randomized)
  planRoutesWithRandomization(vehicle) {
    const allPoints = [this.depot, ...this.deliveryPoints];
    const unvisited = new Set(this.deliveryPoints.map((p) => p.id));
    const routes = [];
    let totalDistance = 0;
    while (unvisited.size > 0) {
      const currentRoute = [this.depot];
      let currentLocation = this.depot.id;
      let routeDistance = 0;
      vehicle.resetLoad();
      while (unvisited.size > 0) {
        const candidates = [];
        for (const neighbor of unvisited) {
          const demand = allPoints.find((p) => p.id === neighbor).demand;
          if (vehicle.canLoad(demand)) {
            const distance = this.distanceMatrix[currentLocation][neighbor];
            candidates.push({ id: neighbor, distance, demand });
          }
        }
        const restrictedCandidates = [...candidates].sort((a, b) => a.distance - b.distance).slice(0, this.rclSize);
        if (restrictedCandidates.length === 0) break;
        const randomIndex = Math.floor(Math.random() * restrictedCandidates.length);
        const chosen = restrictedCandidates[randomIndex];
        const nextPoint = allPoints.find((p) => p.id === chosen.id);
        vehicle.load(nextPoint.demand);
        currentRoute.push(nextPoint);
        routeDistance += chosen.distance;
        unvisited.delete(chosen.id);
        currentLocation = chosen.id;
      }
      routeDistance += this.distanceMatrix[currentLocation][this.depot.id];
      currentRoute.push(this.depot);
      routes.push(currentRoute);
      totalDistance += routeDistance;
    }
    return { routes, totalDistance };
  }
};
var grasp = () => __async(void 0, null, function* () {
  const depot = new Depot({ id: "Dep\xF3sito", x: -40.3375, y: -20.3155 });
  const deliveryPoints = [
    new DeliveryPoint({ id: "Praia do Canto", x: -40.3248, y: -20.3152, demand: 2 }),
    new DeliveryPoint({ id: "Jardim Camburi", x: -40.3445, y: -20.3192, demand: 1 }),
    new DeliveryPoint({ id: "Mata da Praia", x: -40.3506, y: -20.338, demand: 3 }),
    new DeliveryPoint({ id: "Centro de Vit\xF3ria", x: -40.3041, y: -20.3296, demand: 2 }),
    new DeliveryPoint({ id: "Ilha do Boi", x: -40.2854, y: -20.3127, demand: 1 })
  ];
  const vehicle = new Vehicle({ id: "Caminh\xE3o1", capacity: 5 });
  const routePlanner = new RoutePlanner({
    depot,
    deliveryPoints,
    rclSize: 3
  });
  const valhallaUrl = "http://144.22.215.54:8002";
  yield routePlanner.buildDistanceMatrix(valhallaUrl);
  routePlanner.setStrategy("greedy");
  const greedySolution = routePlanner.planRoutes(vehicle);
  console.log("Solu\xE7\xE3o greedy encontrada:", JSON.stringify(greedySolution, null, 2));
  routePlanner.setStrategy("randomized");
  const randomizedSolution = routePlanner.planRoutes(vehicle);
  console.log("Solu\xE7\xE3o randomized encontrada:", JSON.stringify(randomizedSolution, null, 2));
});

// src/index.ts
grasp();

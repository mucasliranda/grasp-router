import { v4 as uuidv4 } from "uuid";
import axios from "axios";

// Classe para representar um ponto de entrega
class DeliveryPoint {
  public id: string;
  public x: number;
  public y: number;
  public demand: number;

  constructor({
    id,
    x,
    y,
    demand,
  }: {
    id?: string;
    x: number;
    y: number;
    demand: number;
  }) {
    this.id = id || uuidv4();
    this.x = x;
    this.y = y;
    this.demand = demand;
  }
}

// Classe para representar o depósito
class Depot extends DeliveryPoint {
  constructor({
    id,
    x,
    y,
  }: {
    id?: string;
    x: number;
    y: number;
  }) {
    super({ id, x, y, demand: 0 });
  }
}

// Classe para representar um veículo
class Vehicle {
  public id: string;
  public capacity: number;
  public currentLoad: number;

  constructor({
    id,
    capacity,
    currentLoad = 0,
  }: {
    id?: string;
    capacity: number;
    currentLoad?: number;
  }) {
    this.id = id || uuidv4();
    this.capacity = capacity;
    this.currentLoad = currentLoad;
  }

  // Reseta a carga do veículo ao retornar ao depósito
  resetLoad() {
    this.currentLoad = 0;
  }

  // Verifica se o veículo pode carregar uma demanda específica
  canLoad(demand: number): boolean {
    return this.currentLoad + demand <= this.capacity;
  }

  // Carrega um ponto de entrega
  load(demand: number) {
    if (!this.canLoad(demand)) {
      throw new Error(`Veículo ${this.id} não pode carregar ${demand}`);
    }
    this.currentLoad += demand;
  }
}

type RouteStrategy = (vehicle: Vehicle) => { routes: DeliveryPoint[][]; totalDistance: number };

// Classe para gerenciar a lógica de roteamento
class RoutePlanner {
  private distanceMatrix: Record<string, Record<string, number>> = {};
  private depot: Depot;
  private deliveryPoints: DeliveryPoint[];
  private strategy: RouteStrategy;
  // melhores candidatos disponíveis para seleção aleatória
  private rclSize: number;

  constructor({ depot, deliveryPoints, rclSize }: { depot: Depot, deliveryPoints: DeliveryPoint[], rclSize?: number }) {
    this.depot = depot;
    this.deliveryPoints = deliveryPoints;
    this.rclSize = rclSize || 3;
  }

  // Método para executar a estratégia definida
  planRoutes(vehicle: Vehicle) {
    return this.strategy(vehicle);
  }

  // Método para definir a estratégia de roteamento
  setStrategy(strategy: 'greedy' | 'randomized',) {
    const mapper = {
      'greedy': this.planRoutesGreedy,
      'randomized': this.planRoutesWithRandomization,
    }

    this.strategy = mapper[strategy];

    console.log("Estratégia definida:", strategy);
  }

  // Constrói a matriz de distâncias usando Valhalla
  async buildDistanceMatrix(valhallaUrl: string): Promise<void> {
    const allPoints = [this.depot, ...this.deliveryPoints];
    this.distanceMatrix = {};

    for (const from of allPoints) {
      this.distanceMatrix[from.id] = {};
      for (const to of allPoints) {
        if (from.id !== to.id) {
          const distance = await this.fetchDistance(valhallaUrl, from, to);
          this.distanceMatrix[from.id][to.id] = distance;
        }
      }
    }

    console.log("Matriz de distâncias construída:", this.distanceMatrix);
  }

  // Busca a distância entre dois pontos via Valhalla
  private async fetchDistance(valhallaUrl: string, from: DeliveryPoint, to: DeliveryPoint): Promise<number> {
    const response = await axios.post(`${valhallaUrl}/route`, {
      locations: [
        { lat: from.y, lon: from.x },
        { lat: to.y, lon: to.x },
      ],
      costing: "auto",
      directions_options: { units: "kilometers" },
    });

    const route = response.data.trip;
    if (route && route.legs.length > 0) {
      return route.legs[0].summary.length; // Retorna distância em km
    } else {
      throw new Error("Rota não encontrada");
    }
  }

  // Gera as rotas considerando a capacidade do veículo
  private planRoutesGreedy(vehicle: Vehicle): { routes: DeliveryPoint[][]; totalDistance: number } {
    const allPoints = [this.depot, ...this.deliveryPoints];
    const unvisited = new Set(this.deliveryPoints.map((p) => p.id));
    const routes: DeliveryPoint[][] = [];
    let totalDistance = 0;

    while (unvisited.size > 0) {
      const currentRoute: DeliveryPoint[] = [this.depot];
      let currentLocation = this.depot.id;
      let routeDistance = 0;
      vehicle.resetLoad();

      while (unvisited.size > 0) {
        let nearestNeighbor: string | null = null;
        let shortestDistance = Infinity;

        for (const neighbor of unvisited) {
          const demand = allPoints.find((p) => p.id === neighbor)!.demand;
          if (vehicle.canLoad(demand)) {
            const distance = this.distanceMatrix[currentLocation][neighbor];
            if (distance < shortestDistance) {
              shortestDistance = distance;
              nearestNeighbor = neighbor;
            }
          }
        }

        if (nearestNeighbor === null) break; // Nenhum cliente acessível

        const nextLocation = nearestNeighbor!;
        const nextPoint = allPoints.find((p) => p.id === nextLocation)!;
        vehicle.load(nextPoint.demand);
        currentRoute.push(nextPoint);
        routeDistance += this.distanceMatrix[currentLocation][nextLocation];
        unvisited.delete(nextLocation);
        currentLocation = nextLocation;
      }

      // Retorna ao depósito
      routeDistance += this.distanceMatrix[currentLocation][this.depot.id];
      currentRoute.push(this.depot);

      routes.push(currentRoute);
      totalDistance += routeDistance;
    }

    return { routes, totalDistance };
  }

  // Estratégia com seleção aleatória entre os melhores candidatos (randomized)
  private planRoutesWithRandomization(vehicle: Vehicle): { routes: DeliveryPoint[][]; totalDistance: number } {
    const allPoints = [this.depot, ...this.deliveryPoints];
    const unvisited = new Set(this.deliveryPoints.map((p) => p.id));
    const routes: DeliveryPoint[][] = [];
    let totalDistance = 0;

    while (unvisited.size > 0) {
      const currentRoute: DeliveryPoint[] = [this.depot];
      let currentLocation = this.depot.id;
      let routeDistance = 0;
      vehicle.resetLoad();

      while (unvisited.size > 0) {
        const candidates: { id: string; distance: number; demand: number }[] = [];

        for (const neighbor of unvisited) {
          const demand = allPoints.find((p) => p.id === neighbor)!.demand;
          if (vehicle.canLoad(demand)) {
            const distance = this.distanceMatrix[currentLocation][neighbor];
            candidates.push({ id: neighbor, distance, demand });
          }
        }

        // Ordena os candidatos por distância e seleciona os 'rclSize' melhores
        // candidates.sort((a, b) => a.distance - b.distance);
        const restrictedCandidates = [...candidates].sort((a, b) => a.distance - b.distance).slice(0, this.rclSize);

        if (restrictedCandidates.length === 0) break; // Nenhum cliente acessível

        // Escolha aleatória entre os melhores candidatos
        const randomIndex = Math.floor(Math.random() * restrictedCandidates.length);
        const chosen = restrictedCandidates[randomIndex];

        const nextPoint = allPoints.find((p) => p.id === chosen.id)!;
        vehicle.load(nextPoint.demand);
        currentRoute.push(nextPoint);
        routeDistance += chosen.distance;
        unvisited.delete(chosen.id);
        currentLocation = chosen.id;
      }

      // Retorna ao depósito
      routeDistance += this.distanceMatrix[currentLocation][this.depot.id];
      currentRoute.push(this.depot);

      routes.push(currentRoute);
      totalDistance += routeDistance;
    }

    return { routes, totalDistance };
  }
}

// Execução principal
export const grasp = async () => {
  const depot = new Depot({ id: 'Depósito', x: -40.3375, y: -20.3155 });

  const deliveryPoints = [
    new DeliveryPoint({ id: 'Praia do Canto', x: -40.3248, y: -20.3152, demand: 2 }),
    new DeliveryPoint({ id: 'Jardim Camburi', x: -40.3445, y: -20.3192, demand: 1 }),
    new DeliveryPoint({ id: 'Mata da Praia', x: -40.3506, y: -20.3380, demand: 3 }),
    new DeliveryPoint({ id: 'Centro de Vitória', x: -40.3041, y: -20.3296, demand: 2 }),
    new DeliveryPoint({ id: 'Ilha do Boi', x: -40.2854, y: -20.3127, demand: 1 }),
  ];

  const vehicle = new Vehicle({ id: 'Caminhão1', capacity: 5 }); // Capacidade máxima de 5
  const routePlanner = new RoutePlanner({
    depot,
    deliveryPoints,
    rclSize: 3,
  });

  const valhallaUrl = "http://144.22.215.54:8002"; // URL do Valhalla
  await routePlanner.buildDistanceMatrix(valhallaUrl);

  routePlanner.setStrategy('greedy')

  const greedySolution = routePlanner.planRoutes(vehicle);
  console.log("Solução greedy encontrada:", JSON.stringify(greedySolution, null, 2));

  routePlanner.setStrategy('randomized')

  const randomizedSolution = routePlanner.planRoutes(vehicle);
  console.log("Solução randomized encontrada:", JSON.stringify(randomizedSolution, null, 2));
};

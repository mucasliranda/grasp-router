import axios from "axios";

// Tipos de dados
type Location = {
  id: number;
  x: number; // longitude
  y: number; // latitude
};

type Route = {
  locations: Location[];
  totalDistance: number;
};

type Solution = {
  route: Route;
  totalDistance: number;
};

// Localização do depósito (ponto inicial)
const depot: Location = { id: 1, x: -40.3248, y: -20.3152 };

// Lista de clientes (locais a visitar)
const customers: Location[] = [
  { id: 2, x: -40.3445, y: -20.3192 },
  { id: 3, x: -40.3506, y: -20.338 },
  { id: 4, x: -40.3041, y: -20.3296 },
  { id: 5, x: -40.2854, y: -20.3127 },
];

let fetchCounter = 0;

const apiUrl = "http://144.22.215.54:8002";

// Função para calcular a distância entre dois pontos usando Valhalla
async function calculateDistance(from: Location, to: Location): Promise<number> {
  const valhallaUrl = `${apiUrl}/route`;
  const body = {
    locations: [
      { lat: from.y, lon: from.x },
      { lat: to.y, lon: to.x },
    ],
    costing: "auto",
    directions_options: { units: "kilometers" },
  };

  console.log(`Chamada ${++fetchCounter}: ${from.id} -> ${to.id}`);

  try {
    const response = await axios.post(valhallaUrl, body);
    return response.data.trip.summary.length; // Retorna a distância total
  } catch (error) {
    console.error("Erro ao calcular a distância:", error);
    return Infinity; // Penalidade em caso de erro
  }
}

// Algoritmo GRASP para encontrar a melhor rota
async function findBestRoute(
  depot: Location,
  customers: Location[]
): Promise<Solution> {
  const maxIterations = 100;
  const alpha = 0.3; // Controle de aleatoriedade
  let bestRoute: Route = { locations: [], totalDistance: Infinity };

  for (let i = 0; i < maxIterations; i++) {
    const candidateRoute = await greedyRandomizedConstruction(depot, customers, alpha);
    if (candidateRoute.totalDistance < bestRoute.totalDistance) {
      bestRoute = candidateRoute;
    }
  }

  return { route: bestRoute, totalDistance: bestRoute.totalDistance };
}

// Fase de construção GRASP
async function greedyRandomizedConstruction(
  depot: Location,
  customers: Location[],
  alpha: number
): Promise<Route> {
  let currentLocation = depot;
  const remainingCustomers = [...customers];
  const route: Location[] = [depot];
  let totalDistance = 0;

  while (remainingCustomers.length > 0) {
    // Calcular custos (distâncias) para os clientes restantes
    const distances = await Promise.all(
      remainingCustomers.map((customer) => calculateDistance(currentLocation, customer))
    );

    // Ordenar clientes por distância crescente
    const sortedCustomers = remainingCustomers.map((customer, idx) => ({
      customer,
      distance: distances[idx],
    }));
    sortedCustomers.sort((a, b) => a.distance - b.distance);

    // Construir a lista restrita de candidatos (RCL)
    const rcl = sortedCustomers.slice(0, Math.ceil(alpha * sortedCustomers.length));

    // Escolher aleatoriamente da RCL
    const selected = rcl[Math.floor(Math.random() * rcl.length)];

    // Atualizar a rota
    totalDistance += selected.distance;
    route.push(selected.customer);
    currentLocation = selected.customer;

    // Remover cliente selecionado
    remainingCustomers.splice(
      remainingCustomers.findIndex((c) => c.id === selected.customer.id),
      1
    );
  }

  // Retornar ao depósito
  totalDistance += await calculateDistance(currentLocation, depot);
  route.push(depot);

  return { locations: route, totalDistance };
}

// Executar o algoritmo
export const grasp = async () => {
  const bestSolution = await findBestRoute(depot, customers);
  console.log('Melhor solução encontrada:', JSON.stringify(bestSolution, null, 2));
  console.log('Melhor solução encontrada:', bestSolution);
};

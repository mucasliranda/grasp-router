import axios from 'axios';

// Interfaces para dados do problema
interface Location {
  id: number;
  x: number; // Longitude
  y: number; // Latitude
}

interface Route {
  locations: Location[];
  totalDistance: number;
}

interface Solution {
  routes: Route[];
  totalDistance: number;
}

const depot: Location = { id: 0, x: -40.3375, y: -20.3155 }; // Exemplo: centro de Vitória
const customers: Location[] = [
  { id: 1, x: -40.3248, y: -20.3152 }, // Praia do Canto
  { id: 2, x: -40.3445, y: -20.3192 }, // Jardim Camburi
  { id: 3, x: -40.3506, y: -20.3380 }, // Mata da Praia
  { id: 4, x: -40.3041, y: -20.3296 }, // Centro de Vitória
  { id: 5, x: -40.2854, y: -20.3127 }, // Ilha do Boi
];

let fetchCounter = 0;

const valhallaUrl = "http://144.22.215.54:8002";

// Função para obter a distância entre dois pontos via Valhalla
async function fetchDistance(from: Location, to: Location): Promise<number> {
  const response = await axios.post(`${valhallaUrl}/route`, {
    locations: [
      { lat: from.y, lon: from.x },
      { lat: to.y, lon: to.x },
    ],
    costing: "auto",
    directions_options: { units: "kilometers" },
  });

  console.log(`Chamada ${++fetchCounter}: ${from.id} -> ${to.id}`);

  const route = response.data.trip;
  if (route && route.legs.length > 0) {
    return route.legs[0].summary.length; // Retorna distância em km
  } else {
    throw new Error("Rota não encontrada");
  }
}

// Função para construir uma matriz de distâncias usando Valhalla
async function buildDistanceMatrix(locations: Location[]): Promise<number[][]> {
  const distanceMatrix: number[][] = Array(locations.length)
    .fill(0)
    .map(() => Array(locations.length).fill(0));

  console.log('Construindo matriz de distâncias...', distanceMatrix);

  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const distance = await fetchDistance(locations[i], locations[j]);
      distanceMatrix[i][j] = distance;
      distanceMatrix[j][i] = distance; // Matriz simétrica
    }
  }
  return distanceMatrix;
}

// Função gulosa para construir a rota
function greedyConstruction(
  depotIndex: number,
  locations: Location[],
  distanceMatrix: number[][]
): Route {
  const depot = locations[depotIndex];
  const unvisited = new Set(locations.map((_, idx) => idx).filter((idx) => idx !== depotIndex));
  const route: Location[] = [depot];
  let currentLocation = depotIndex;
  let totalDistance = 0;

  while (unvisited.size > 0) {
    let nearestNeighbor: number | null = null;
    let shortestDistance = Infinity;

    for (const neighbor of unvisited) {
      const distance = distanceMatrix[currentLocation][neighbor];
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestNeighbor = neighbor;
      }
    }

    if (nearestNeighbor === null) break;

    route.push(locations[nearestNeighbor]);
    totalDistance += shortestDistance;
    unvisited.delete(nearestNeighbor);
    currentLocation = nearestNeighbor;
  }

  // Retorna ao depot
  totalDistance += distanceMatrix[currentLocation][depotIndex];
  route.push(depot);

  return { locations: route, totalDistance };
}

async function graspTSP(
  depot: Location,
  customers: Location[],
  iterations: number
): Promise<Route> {
  const allLocations = [depot, ...customers];
  const distanceMatrix = await buildDistanceMatrix(allLocations);
  let bestRoute: Route | null = null;

  for (let i = 0; i < iterations; i++) {
    const candidateRoute = greedyConstruction(0, allLocations, distanceMatrix);
    if (!bestRoute || candidateRoute.totalDistance < bestRoute.totalDistance) {
      bestRoute = candidateRoute;
    }
  }

  return bestRoute!;
}

// Exemplo de uso com coordenadas reais de Vitória, ES
export const grasp = async () => {
  const iterations = 10;
  const bestSolution = await graspTSP(depot, customers, iterations);
  console.log('Melhor solução encontrada:', JSON.stringify(bestSolution, null, 2));
  console.log('Melhor solução encontrada:', bestSolution);
}
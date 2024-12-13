import axios from "axios";

// Interfaces para dados do problema
interface Location {
  id: number;
  x: number; // Longitude
  y: number; // Latitude
  demand: number; // Demanda de carga no local
}

interface Route {
  locations: Location[];
  totalDistance: number;
}

interface Solution {
  routes: Route[];
  totalDistance: number;
}

const depot: Location = { id: 0, x: -40.3375, y: -20.3155, demand: 0 }; // Exemplo: centro de Vitória
const customers: Location[] = [
  { id: 1, x: -40.3248, y: -20.3152, demand: 2 }, // Praia do Canto
  { id: 2, x: -40.3445, y: -20.3192, demand: 1 }, // Jardim Camburi
  { id: 3, x: -40.3506, y: -20.3380, demand: 3 }, // Mata da Praia
  { id: 4, x: -40.3041, y: -20.3296, demand: 2 }, // Centro de Vitória
  { id: 5, x: -40.2854, y: -20.3127, demand: 1 }, // Ilha do Boi
];

const valhallaUrl = "http://144.22.215.54:8002"; // URL do Valhalla

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

  const route = response.data.trip;
  if (route && route.legs.length > 0) {
    return route.legs[0].summary.length; // Retorna distância em km
  } else {
    throw new Error("Rota não encontrada");
  }
}

// Construção da matriz de distâncias usando Valhalla
async function buildDistanceMatrix(locations: Location[]): Promise<number[][]> {
  const distanceMatrix: number[][] = Array(locations.length)
    .fill(0)
    .map(() => Array(locations.length).fill(0));

  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const distance = await fetchDistance(locations[i], locations[j]);
      distanceMatrix[i][j] = distance;
      distanceMatrix[j][i] = distance; // Matriz simétrica
    }
  }

  return distanceMatrix;
}

// Função para encontrar rotas com capacidade limitada
function findRoutesWithCapacity(
  depotIndex: number,
  locations: Location[],
  distanceMatrix: number[][],
  maxCapacity: number
): Solution {
  const depot = locations[depotIndex];
  const unvisited = new Set(locations.map((_, idx) => idx).filter((idx) => idx !== depotIndex));
  const routes: Route[] = [];
  let totalDistance = 0;

  while (unvisited.size > 0) {
    const route: Location[] = [depot];
    let currentLocation = depotIndex;
    let currentCapacity = 0;
    let routeDistance = 0;

    while (unvisited.size > 0) {
      let nearestNeighbor: number | null = null;
      let shortestDistance = Infinity;

      // Encontrar cliente mais próximo dentro do limite de capacidade
      for (const neighbor of unvisited) {
        const demand = locations[neighbor].demand;
        if (currentCapacity + demand <= maxCapacity) {
          const distance = distanceMatrix[currentLocation][neighbor];
          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestNeighbor = neighbor;
          }
        }
      }

      if (nearestNeighbor === null) break; // Sem clientes acessíveis no momento

      // Atualizar rota
      const nextLocation = nearestNeighbor!;
      route.push(locations[nextLocation]);
      routeDistance += distanceMatrix[currentLocation][nextLocation];
      currentCapacity += locations[nextLocation].demand;
      unvisited.delete(nextLocation);
      currentLocation = nextLocation;
    }

    // Retorna ao depot
    routeDistance += distanceMatrix[currentLocation][depotIndex];
    route.push(depot);

    // Adiciona rota e distância total
    routes.push({ locations: route, totalDistance: routeDistance });
    totalDistance += routeDistance;
  }

  return { routes, totalDistance };
}

// Executar o algoritmo
export const grasp = async () => {
  const maxCapacity = 5; // Capacidade máxima do caminhão
  const allLocations = [depot, ...customers];
  const distanceMatrix = await buildDistanceMatrix(allLocations);
  console.log("Matriz de distâncias:", distanceMatrix);

  const solution = findRoutesWithCapacity(0, allLocations, distanceMatrix, maxCapacity);
  console.log("Melhor solução encontrada:", JSON.stringify(solution, null, 2));
}

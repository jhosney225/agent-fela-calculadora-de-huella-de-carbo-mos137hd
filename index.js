
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const client = new Anthropic();

interface CarbonEntry {
  category: string;
  description: string;
  amount: number;
  unit: string;
  co2Equivalent: number;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const conversationHistory: ConversationMessage[] = [];
const carbonEntries: CarbonEntry[] = [];

// Factores de emisión de CO2 aproximados (kg CO2e)
const emissionFactors: { [key: string]: number } = {
  // Transporte (por km)
  auto: 0.21,
  autoelectrico: 0.05,
  autohibrido: 0.1,
  bus: 0.089,
  tren: 0.041,
  avion_corta: 0.255,
  avion_larga: 0.195,

  // Energía (por kWh)
  electricidad_carbon: 0.82,
  electricidad_renovable: 0.1,
  gasolina: 2.31,
  diesel: 2.68,
  gas_natural: 2.04,

  // Alimentación (por kg)
  carne_res: 27.0,
  carne_pollo: 6.9,
  carne_cerdo: 12.1,
  pescado: 12.0,
  vegetales: 2.0,
  productos_lacteos: 23.8,

  // Productos (por unidad)
  nueva_ropa: 25.0,
  nuevo_telefono: 85.0,
  nueva_tv: 200.0,
};

async function sendMessage(userMessage: string): Promise<string> {
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const systemPrompt = `Eres un asistente experto en calculadora de huella de carbono personal. Tu tarea es ayudar al usuario a calcular su huella de carbono basándote en sus actividades diarias.

Datos de emisiones disponibles:
${JSON.stringify(emissionFactors, null, 2)}

Cuando el usuario mencione una actividad, extrae:
1. Categoría (transporte, energía, alimentación, productos)
2. Tipo específico
3. Cantidad y unidad
4. Calcula el CO2 equivalente usando los factores

Proporciona conversaciones amigables y educativas. Sugiere formas de reducir la huella de carbono. 
Si el usuario describe una actividad que no está en los factores, estima razonablemente basándote en actividades similares.
Mantén un tono conversacional y empático.`;

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: systemPrompt,
    messages: conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  });

  const assistantMessage =
    response.content[0].type === "text" ? response.content[0].text : "";

  conversationHistory.push({
    role: "assistant",
    content: assistantMessage,
  });

  // Parsear la respuesta para extraer actividades
  parseAndStoreActivity(userMessage, assistantMessage);

  return assistantMessage;
}

function parseAndStoreActivity(
  userMessage: string,
  assistantResponse: string
): void {
  // Detectar patrones de actividades en el mensaje del usuario
  const transportPatterns = [
    { pattern: /(\d+)\s*km\s*(?:en\s+)?auto/i, type: "auto", unit: "km" },
    {
      pattern: /(\d+)\s*km\s*(?:en\s+)?autoelectrico/i,
      type: "autoelectrico",
      unit: "km",
    },
    {
      pattern: /(\d+)\s*km\s*(?:en\s+)?(?:bus|autobús)/i,
      type: "bus",
      unit: "km",
    },
    { pattern: /(\d+)\s*km\s*(?:en\s+)?tren/i, type: "tren", unit: "km" },
    {
      pattern: /(\d+)\s*km\s*(?:en\s+)?avion/i,
      type: "avion_larga",
      unit: "km",
    },
  ];

  const foodPatterns = [
    {
      pattern: /(\d+)\s*(?:kg|kilos?)\s*(?:de\s+)?carne\s+(?:de\s+)?res/i,
      type: "carne_res",
      unit: "kg",
    },
    {
      pattern: /(\d+)\s*(?:kg|kilos?)\s*(?:de\s+)?pollo/i,
      type: "carne_pollo",
      unit: "kg",
    },
    {
      pattern: /(\d+)\s*(?:kg|kilos?)\s*(?:de\s+)?pescado/i,
      type: "pescado",
      unit: "kg",
    },
    {
      pattern: /(\d+)\s*(?:kg|kilos?)\s*(?:de\s+)?vegetales/i,
      type: "vegetales",
      unit: "kg",
    },
  ];

  const energyPatterns = [
    {
      pattern: /(\d+)\s*(?:kwh|kW\.?h)\s*(?:de\s+)?electricidad/i,
      type: "electricidad_carbon",
      unit: "kWh",
    },
    {
      pattern: /(\d+)\s*(?
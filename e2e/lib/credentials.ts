// Credenciales de las E2E: NUNCA escritas en el repositorio (que es público).
// playwright.config.ts las genera al azar en cada corrida y las hereda cada
// worker por el entorno. La base de E2E se vacía al empezar, así que la
// contraseña se crea de nuevo en el primer login de cada corrida.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name}: corre las E2E con \`npm run test:e2e\` (playwright.config.ts la genera).`);
  return v;
}

export const PASSWORD = required("E2E_PASSWORD");
export const SIRI_TOKEN = required("E2E_SIRI_TOKEN");

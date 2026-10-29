import { requireTestDatabaseUrl } from "../scripts/lib/require-test-db.mjs";

// Antes de que cualquier prueba importe @/lib/db: la app se conecta SOLO a la
// base de pruebas. La guardia se detiene si TEST_DATABASE_URL falta o coincide
// con producción. Varias conexiones para poder probar completados simultáneos.
process.env.DATABASE_URL = requireTestDatabaseUrl();
process.env.DB_POOL_MAX = "4";

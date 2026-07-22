import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAdminOpenApiDocument } from "../modules/admin/admin.openapi";

const target = resolve(process.cwd(), "openapi", "admin.openapi.json");
await mkdir(resolve(process.cwd(), "openapi"), { recursive: true });
await writeFile(target, `${JSON.stringify(createAdminOpenApiDocument(), null, 2)}\n`, "utf8");
console.log(`Generated ${target}`);

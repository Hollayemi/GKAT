"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = require("fs");
const path_1 = require("path");
const router = (0, express_1.Router)();
const routeDir = __dirname;
const currentFile = (0, path_1.basename)(__filename);
const routeFiles = (0, fs_1.readdirSync)(routeDir).filter((file) => file !== currentFile &&
    (file.endsWith('.js') || file.endsWith('.ts')) &&
    !file.endsWith('.d.ts') &&
    !file.includes('.test.') &&
    !file.includes('.spec.'));
routeFiles.forEach((file) => {
    try {
        const routeName = file.replace(/\.(js|ts)$/, '');
        const routeModule = require((0, path_1.join)(routeDir, routeName));
        if (routeModule.default && typeof routeModule.default === 'function') {
            router.use(routeModule.default);
            console.log(`Loaded route: /${routeName}`);
        }
        else {
            console.warn(` Route file ${file} does not export a default router`);
        }
    }
    catch (error) {
        console.error(`Failed to load route ${file}:`, error);
    }
});
exports.default = router;
//# sourceMappingURL=index.js.map
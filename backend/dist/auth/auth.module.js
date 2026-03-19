"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const jwt_strategy_1 = require("./jwt.strategy");
const users_module_1 = require("../users/users.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            users_module_1.UsersModule,
            passport_1.PassportModule,
            config_1.ConfigModule,
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => ({
                    secret: configService.getOrThrow('JWT_SECRET'),
                    signOptions: {
                        expiresIn: configService.getOrThrow('JWT_EXPIRES_IN'),
                    },
                }),
                inject: [config_1.ConfigService],
            }),
        ],
        providers: [
            auth_service_1.AuthService,
            jwt_strategy_1.JwtStrategy,
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        ],
        controllers: [auth_controller_1.AuthController],
        exports: [auth_service_1.AuthService, jwt_strategy_1.JwtStrategy, passport_1.PassportModule],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const cv_upload_module_1 = require("./cv-upload/cv-upload.module");
const chatbot_module_1 = require("./chatbot/chatbot.module");
const candidates_module_1 = require("./candidates/candidates.module");
const notes_module_1 = require("./notes/notes.module");
const assessfirst_module_1 = require("./assessfirst/assessfirst.module");
const mail_module_1 = require("./mail/mail.module");
const export_module_1 = require("./export/export.module");
const user_entity_1 = require("./users/entities/user.entity");
const candidates_entity_1 = require("./candidates/entities/candidates.entity");
const cv_entity_1 = require("./cvs/entities/cv.entity");
const cv_parsed_data_entity_1 = require("./cv-parsed-data/entities/cv-parsed-data.entity");
const candidate_note_entity_1 = require("./notes/candidate-note.entity");
const assessfirst_result_entity_1 = require("./assessfirst/assessfirst-result.entity");
const dashboard_module_1 = require("./dashboard/dashboard.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (cfg) => ({
                    type: 'postgres',
                    host: cfg.get('DB_HOST'),
                    port: cfg.get('DB_PORT'),
                    username: cfg.get('DB_USERNAME'),
                    password: cfg.get('DB_PASSWORD'),
                    database: cfg.get('DB_DATABASE'),
                    entities: [user_entity_1.User, candidates_entity_1.Candidate, cv_entity_1.Cv, cv_parsed_data_entity_1.CvParsedData, candidate_note_entity_1.CandidateNote, assessfirst_result_entity_1.AssessFirstResult],
                    synchronize: true,
                    logging: false,
                }),
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            cv_upload_module_1.CvUploadModule,
            chatbot_module_1.ChatbotModule,
            candidates_module_1.CandidatesModule,
            notes_module_1.NotesModule,
            assessfirst_module_1.AssessFirstModule,
            mail_module_1.MailModule,
            export_module_1.ExportModule,
            dashboard_module_1.DashboardModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
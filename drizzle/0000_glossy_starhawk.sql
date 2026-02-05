CREATE TYPE "public"."contrat_type" AS ENUM('CDI', 'CDD', 'Mixte');--> statement-breakpoint
CREATE TYPE "public"."log_priority" AS ENUM('info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."log_type" AS ENUM('USER_ACTION', 'SYSTEM_EVENT', 'API_CALL');--> statement-breakpoint
CREATE TYPE "public"."sexe" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"permission_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"reset_token" varchar(255),
	"reset_token_expiry" timestamp with time zone,
	CONSTRAINT "users_name_unique" UNIQUE("name"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid,
	"action_type" varchar(50) NOT NULL,
	"table_name" varchar(100),
	"record_id" varchar(100),
	"old_values" text,
	"new_values" text,
	"type" "log_type" DEFAULT 'USER_ACTION' NOT NULL,
	"entity_type" varchar(50),
	"entity_id" integer,
	"metadata" jsonb,
	"priority" "log_priority" DEFAULT 'info' NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type_id" integer,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(30),
	"mobile" varchar(30),
	"address" text,
	"postal_code" varchar(10),
	"city" varchar(100),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sectors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sectors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "collaborateurs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collaborateurs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"last_name" varchar(100) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"address" text,
	"postal_code" varchar(10),
	"city" varchar(100),
	"mobile_pro" varchar(30),
	"email" varchar(255),
	"secteur_id" integer,
	"taux" numeric(5, 2),
	"contrat_type" "contrat_type",
	"contrat_details" text,
	"canton" varchar(50),
	"pays" varchar(100),
	"sexe" "sexe",
	"date_sortie" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "classes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"ecole_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaborateur_ecoles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collaborateur_ecoles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"collaborateur_id" integer NOT NULL,
	"ecole_id" integer NOT NULL,
	"classe_id" integer,
	"date_debut" date,
	"date_fin" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directeur_remplacements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "directeur_remplacements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ecole_id" integer NOT NULL,
	"directeur_original_id" integer NOT NULL,
	"remplacant_directeur_id" integer NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date,
	"motif" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directeurs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "directeurs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"last_name" varchar(100) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ecoles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ecoles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(200) NOT NULL,
	"etablissement_id" integer NOT NULL,
	"directeur_id" integer,
	"address" text,
	"phone" varchar(30),
	"email" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etablissements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "etablissements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(200) NOT NULL,
	"address" text,
	"postal_code" varchar(10),
	"city" varchar(100),
	"phone" varchar(30),
	"email" varchar(255),
	"directeur_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titulaire_affectations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "titulaire_affectations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"titulaire_id" integer NOT NULL,
	"ecole_id" integer NOT NULL,
	"classe_id" integer,
	"date_debut" date,
	"date_fin" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titulaire_remplacements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "titulaire_remplacements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"affectation_id" integer NOT NULL,
	"titulaire_original_id" integer NOT NULL,
	"remplacant_titulaire_id" integer NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date,
	"motif" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titulaires" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "titulaires_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"last_name" varchar(100) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remplacant_observateurs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "remplacant_observateurs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"remplacant_id" integer NOT NULL,
	"collaborateur_id" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remplacant_remarques" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "remplacant_remarques_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"remplacant_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "remplacants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "remplacants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"last_name" varchar(100) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"address" text,
	"phone" varchar(30),
	"email" varchar(255),
	"is_available" boolean DEFAULT true NOT NULL,
	"availability_note" text,
	"contract_start_time" time,
	"contract_end_time" time,
	"contract_start_date" date,
	"contract_end_date" date,
	"obs_temporaire" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_type_id_contact_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."contact_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateurs" ADD CONSTRAINT "collaborateurs_secteur_id_sectors_id_fk" FOREIGN KEY ("secteur_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateurs" ADD CONSTRAINT "collaborateurs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateurs" ADD CONSTRAINT "collaborateurs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_ecole_id_ecoles_id_fk" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_ecoles" ADD CONSTRAINT "collaborateur_ecoles_collaborateur_id_collaborateurs_id_fk" FOREIGN KEY ("collaborateur_id") REFERENCES "public"."collaborateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_ecoles" ADD CONSTRAINT "collaborateur_ecoles_ecole_id_ecoles_id_fk" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_ecoles" ADD CONSTRAINT "collaborateur_ecoles_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_ecoles" ADD CONSTRAINT "collaborateur_ecoles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborateur_ecoles" ADD CONSTRAINT "collaborateur_ecoles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directeur_remplacements" ADD CONSTRAINT "directeur_remplacements_ecole_id_ecoles_id_fk" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directeur_remplacements" ADD CONSTRAINT "directeur_remplacements_directeur_original_id_directeurs_id_fk" FOREIGN KEY ("directeur_original_id") REFERENCES "public"."directeurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directeur_remplacements" ADD CONSTRAINT "directeur_remplacements_remplacant_directeur_id_directeurs_id_fk" FOREIGN KEY ("remplacant_directeur_id") REFERENCES "public"."directeurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directeur_remplacements" ADD CONSTRAINT "directeur_remplacements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directeur_remplacements" ADD CONSTRAINT "directeur_remplacements_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directeurs" ADD CONSTRAINT "directeurs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directeurs" ADD CONSTRAINT "directeurs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecoles" ADD CONSTRAINT "ecoles_etablissement_id_etablissements_id_fk" FOREIGN KEY ("etablissement_id") REFERENCES "public"."etablissements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecoles" ADD CONSTRAINT "ecoles_directeur_id_directeurs_id_fk" FOREIGN KEY ("directeur_id") REFERENCES "public"."directeurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecoles" ADD CONSTRAINT "ecoles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ecoles" ADD CONSTRAINT "ecoles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etablissements" ADD CONSTRAINT "etablissements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etablissements" ADD CONSTRAINT "etablissements_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_affectations" ADD CONSTRAINT "titulaire_affectations_titulaire_id_titulaires_id_fk" FOREIGN KEY ("titulaire_id") REFERENCES "public"."titulaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_affectations" ADD CONSTRAINT "titulaire_affectations_ecole_id_ecoles_id_fk" FOREIGN KEY ("ecole_id") REFERENCES "public"."ecoles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_affectations" ADD CONSTRAINT "titulaire_affectations_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_affectations" ADD CONSTRAINT "titulaire_affectations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_affectations" ADD CONSTRAINT "titulaire_affectations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_remplacements" ADD CONSTRAINT "titulaire_remplacements_affectation_id_titulaire_affectations_id_fk" FOREIGN KEY ("affectation_id") REFERENCES "public"."titulaire_affectations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_remplacements" ADD CONSTRAINT "titulaire_remplacements_titulaire_original_id_titulaires_id_fk" FOREIGN KEY ("titulaire_original_id") REFERENCES "public"."titulaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_remplacements" ADD CONSTRAINT "titulaire_remplacements_remplacant_titulaire_id_titulaires_id_fk" FOREIGN KEY ("remplacant_titulaire_id") REFERENCES "public"."titulaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_remplacements" ADD CONSTRAINT "titulaire_remplacements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaire_remplacements" ADD CONSTRAINT "titulaire_remplacements_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaires" ADD CONSTRAINT "titulaires_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "titulaires" ADD CONSTRAINT "titulaires_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remplacant_observateurs" ADD CONSTRAINT "remplacant_observateurs_remplacant_id_remplacants_id_fk" FOREIGN KEY ("remplacant_id") REFERENCES "public"."remplacants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remplacant_observateurs" ADD CONSTRAINT "remplacant_observateurs_collaborateur_id_collaborateurs_id_fk" FOREIGN KEY ("collaborateur_id") REFERENCES "public"."collaborateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remplacant_observateurs" ADD CONSTRAINT "remplacant_observateurs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remplacant_remarques" ADD CONSTRAINT "remplacant_remarques_remplacant_id_remplacants_id_fk" FOREIGN KEY ("remplacant_id") REFERENCES "public"."remplacants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remplacant_remarques" ADD CONSTRAINT "remplacant_remarques_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remplacants" ADD CONSTRAINT "remplacants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remplacants" ADD CONSTRAINT "remplacants_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "logs_type_idx" ON "logs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "logs_user_id_idx" ON "logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "logs_created_at_idx" ON "logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "logs_entity_idx" ON "logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "logs_priority_idx" ON "logs" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "contacts_type_id_idx" ON "contacts" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contacts_last_name_idx" ON "contacts" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "contacts_is_active_idx" ON "contacts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "collaborateurs_secteur_id_idx" ON "collaborateurs" USING btree ("secteur_id");--> statement-breakpoint
CREATE INDEX "collaborateurs_email_idx" ON "collaborateurs" USING btree ("email");--> statement-breakpoint
CREATE INDEX "collaborateurs_last_name_idx" ON "collaborateurs" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "collaborateurs_is_active_idx" ON "collaborateurs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "collaborateurs_contrat_type_idx" ON "collaborateurs" USING btree ("contrat_type");--> statement-breakpoint
CREATE INDEX "classes_ecole_id_idx" ON "classes" USING btree ("ecole_id");--> statement-breakpoint
CREATE INDEX "collaborateur_ecoles_collaborateur_id_idx" ON "collaborateur_ecoles" USING btree ("collaborateur_id");--> statement-breakpoint
CREATE INDEX "collaborateur_ecoles_ecole_id_idx" ON "collaborateur_ecoles" USING btree ("ecole_id");--> statement-breakpoint
CREATE INDEX "directeur_remplacements_ecole_id_idx" ON "directeur_remplacements" USING btree ("ecole_id");--> statement-breakpoint
CREATE INDEX "directeur_remplacements_original_id_idx" ON "directeur_remplacements" USING btree ("directeur_original_id");--> statement-breakpoint
CREATE INDEX "directeurs_last_name_idx" ON "directeurs" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "directeurs_is_active_idx" ON "directeurs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ecoles_etablissement_id_idx" ON "ecoles" USING btree ("etablissement_id");--> statement-breakpoint
CREATE INDEX "ecoles_directeur_id_idx" ON "ecoles" USING btree ("directeur_id");--> statement-breakpoint
CREATE INDEX "ecoles_name_idx" ON "ecoles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ecoles_is_active_idx" ON "ecoles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "etablissements_name_idx" ON "etablissements" USING btree ("name");--> statement-breakpoint
CREATE INDEX "etablissements_is_active_idx" ON "etablissements" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "etablissements_directeur_id_idx" ON "etablissements" USING btree ("directeur_id");--> statement-breakpoint
CREATE INDEX "titulaire_affectations_titulaire_id_idx" ON "titulaire_affectations" USING btree ("titulaire_id");--> statement-breakpoint
CREATE INDEX "titulaire_affectations_ecole_id_idx" ON "titulaire_affectations" USING btree ("ecole_id");--> statement-breakpoint
CREATE INDEX "titulaire_remplacements_affectation_id_idx" ON "titulaire_remplacements" USING btree ("affectation_id");--> statement-breakpoint
CREATE INDEX "titulaire_remplacements_original_id_idx" ON "titulaire_remplacements" USING btree ("titulaire_original_id");--> statement-breakpoint
CREATE INDEX "titulaires_last_name_idx" ON "titulaires" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "titulaires_is_active_idx" ON "titulaires" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "remplacant_observateurs_remplacant_id_idx" ON "remplacant_observateurs" USING btree ("remplacant_id");--> statement-breakpoint
CREATE INDEX "remplacant_observateurs_collaborateur_id_idx" ON "remplacant_observateurs" USING btree ("collaborateur_id");--> statement-breakpoint
CREATE INDEX "remplacant_remarques_remplacant_id_idx" ON "remplacant_remarques" USING btree ("remplacant_id");--> statement-breakpoint
CREATE INDEX "remplacant_remarques_created_at_idx" ON "remplacant_remarques" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "remplacants_last_name_idx" ON "remplacants" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "remplacants_is_active_idx" ON "remplacants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "remplacants_is_available_idx" ON "remplacants" USING btree ("is_available");
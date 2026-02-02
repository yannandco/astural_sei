--
-- PostgreSQL database dump
--

\restrict ledlKn1FUfsHbkgG9SQpdTiDPCgzkViBHvQfcK0GYRHU2xCauMMf2bMR9neZJxg

-- Dumped from database version 15.14 (Homebrew)
-- Dumped by pg_dump version 15.14 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: yaya
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO yaya;

--
-- Name: log_priority; Type: TYPE; Schema: public; Owner: astural_sei
--

CREATE TYPE public.log_priority AS ENUM (
    'info',
    'warning',
    'error',
    'critical'
);


ALTER TYPE public.log_priority OWNER TO astural_sei;

--
-- Name: log_type; Type: TYPE; Schema: public; Owner: astural_sei
--

CREATE TYPE public.log_type AS ENUM (
    'USER_ACTION',
    'SYSTEM_EVENT',
    'API_CALL'
);


ALTER TYPE public.log_type OWNER TO astural_sei;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: astural_sei
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'user'
);


ALTER TYPE public.user_role OWNER TO astural_sei;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: contact_types; Type: TABLE; Schema: public; Owner: astural_sei
--

CREATE TABLE public.contact_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(7),
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contact_types OWNER TO astural_sei;

--
-- Name: contact_types_id_seq; Type: SEQUENCE; Schema: public; Owner: astural_sei
--

ALTER TABLE public.contact_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contact_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: astural_sei
--

CREATE TABLE public.contacts (
    id integer NOT NULL,
    type_id integer,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255),
    phone character varying(30),
    mobile character varying(30),
    address text,
    postal_code character varying(10),
    city character varying(100),
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.contacts OWNER TO astural_sei;

--
-- Name: contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: astural_sei
--

ALTER TABLE public.contacts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.contacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: logs; Type: TABLE; Schema: public; Owner: astural_sei
--

CREATE TABLE public.logs (
    id integer NOT NULL,
    user_id uuid,
    action_type character varying(50) NOT NULL,
    table_name character varying(100),
    record_id character varying(100),
    old_values text,
    new_values text,
    type public.log_type DEFAULT 'USER_ACTION'::public.log_type NOT NULL,
    entity_type character varying(50),
    entity_id integer,
    metadata jsonb,
    priority public.log_priority DEFAULT 'info'::public.log_priority NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.logs OWNER TO astural_sei;

--
-- Name: logs_id_seq; Type: SEQUENCE; Schema: public; Owner: astural_sei
--

ALTER TABLE public.logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: astural_sei
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.permissions OWNER TO astural_sei;

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: astural_sei
--

ALTER TABLE public.permissions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: astural_sei
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO astural_sei;

--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: astural_sei
--

CREATE TABLE public.user_permissions (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.user_permissions OWNER TO astural_sei;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: astural_sei
--

ALTER TABLE public.user_permissions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: astural_sei
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password text NOT NULL,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    reset_token character varying(255),
    reset_token_expiry timestamp with time zone
);


ALTER TABLE public.users OWNER TO astural_sei;

--
-- Name: contact_types contact_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.contact_types
    ADD CONSTRAINT contact_types_name_unique UNIQUE (name);


--
-- Name: contact_types contact_types_pkey; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.contact_types
    ADD CONSTRAINT contact_types_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_unique; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_unique UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_name_unique; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_name_unique UNIQUE (name);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: contacts_email_idx; Type: INDEX; Schema: public; Owner: astural_sei
--

CREATE INDEX contacts_email_idx ON public.contacts USING btree (email);


--
-- Name: contacts_is_active_idx; Type: INDEX; Schema: public; Owner: astural_sei
--

CREATE INDEX contacts_is_active_idx ON public.contacts USING btree (is_active);


--
-- Name: contacts_last_name_idx; Type: INDEX; Schema: public; Owner: astural_sei
--

CREATE INDEX contacts_last_name_idx ON public.contacts USING btree (last_name);


--
-- Name: contacts_type_id_idx; Type: INDEX; Schema: public; Owner: astural_sei
--

CREATE INDEX contacts_type_id_idx ON public.contacts USING btree (type_id);


--
-- Name: logs_created_at_idx; Type: INDEX; Schema: public; Owner: astural_sei
--

CREATE INDEX logs_created_at_idx ON public.logs USING btree (created_at);


--
-- Name: logs_entity_idx; Type: INDEX; Schema: public; Owner: astural_sei
--

CREATE INDEX logs_entity_idx ON public.logs USING btree (entity_type, entity_id);


--
-- Name: logs_priority_idx; Type: INDEX; Schema: public; Owner: astural_sei
--

CREATE INDEX logs_priority_idx ON public.logs USING btree (priority);


--
-- Name: logs_type_idx; Type: INDEX; Schema: public; Owner: astural_sei
--

CREATE INDEX logs_type_idx ON public.logs USING btree (type);


--
-- Name: logs_user_id_idx; Type: INDEX; Schema: public; Owner: astural_sei
--

CREATE INDEX logs_user_id_idx ON public.logs USING btree (user_id);


--
-- Name: contacts contacts_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_type_id_contact_types_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_type_id_contact_types_id_fk FOREIGN KEY (type_id) REFERENCES public.contact_types(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: logs logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_permission_id_permissions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_permissions_id_fk FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: astural_sei
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: yaya
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict ledlKn1FUfsHbkgG9SQpdTiDPCgzkViBHvQfcK0GYRHU2xCauMMf2bMR9neZJxg


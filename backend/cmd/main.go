package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB
var jwtSecret = []byte("secretkey") // ganti dari env kalau di production

func main() {
	var err error

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@db:5432/notesdb?sslmode=disable"
	}

	db, err = sql.Open("pgx", dbURL)
	if err != nil {
		log.Fatal("DB error:", err)
	}
	err = db.Ping()
	if err != nil {
		log.Fatal("DB unreachable:", err)
	}

	log.Println("Connected to database!")

	// run migrations (create tables if not exists)
	if err := runMigrations(); err != nil {
		log.Fatal("Migration error:", err)
	}

	app := fiber.New()

	// CORS
	app.Use(func(c *fiber.Ctx) error {
		c.Set("Access-Control-Allow-Origin", "*")
		c.Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Method() == "OPTIONS" {
			return c.SendStatus(200)
		}
		return c.Next()
	})

	// Logging
	app.Use(requestLogger)

	// Auth
	app.Post("/register", registerHandler)
	app.Post("/login", loginHandler)

	// Notes group with auth middleware
	notes := app.Group("/notes", authMiddleware)
	notes.Get("/", getNotes)
	notes.Post("/", createNote)
	notes.Put("/:id", updateNote)
	notes.Delete("/:id", deleteNote)
	notes.Post("/:id/share", shareNote)
	notes.Post("/join", joinNoteByToken)
	notes.Post("/:id/generate_share_token", shareNote)

	log.Println("Server running on port 8000")
	log.Fatal(app.Listen(":8000"))
}

// ========== MIGRATIONS ==========
func runMigrations() error {

	// users table
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		username VARCHAR(100) UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT now()
	);
	`)
	if err != nil {
		return err
	}

	// notes table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS notes (
		id SERIAL PRIMARY KEY,
		user_id INT REFERENCES users(id) ON DELETE CASCADE,
		date DATE,
		type VARCHAR(20) NOT NULL DEFAULT 'note',
		content TEXT,
		status VARCHAR(20),
		share_token VARCHAR(100) UNIQUE,
		created_at TIMESTAMP DEFAULT now(),
		updated_at TIMESTAMP DEFAULT now()
	);
	`)
	if err != nil {
		return err
	}

	// collaborators table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS note_collaborators (
		id SERIAL PRIMARY KEY,
		note_id INT REFERENCES notes(id) ON DELETE CASCADE,
		user_id INT REFERENCES users(id) ON DELETE CASCADE,
		can_edit BOOLEAN DEFAULT TRUE,
		UNIQUE(note_id, user_id)
	);
	`)
	if err != nil {
		return err
	}

	// logs table
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS logs (
		id SERIAL PRIMARY KEY,
		datetime TIMESTAMP NOT NULL,
		method TEXT,
		endpoint TEXT,
		request_headers JSONB,
		payload JSONB,
		response_body JSONB,
		status_code INT
	);
	`)
	if err != nil {
		return err
	}

	return nil
}

// ========== REQUEST LOGGER ==========
// note: keep this simple to avoid blocking request flow
func requestLogger(c *fiber.Ctx) error {
	start := time.Now()

	headers, _ := json.Marshal(c.GetReqHeaders())
	body := c.Body()

	err := c.Next()

	resp := c.Response().Body()
	status := c.Response().StatusCode()

	// best-effort: write log, do not fail request if logging errors
	_, _ = db.Exec(`
		INSERT INTO logs (datetime, method, endpoint, request_headers, payload, response_body, status_code)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, start, c.Method(), c.Path(), headers, body, resp, status)

	return err
}

// ========== AUTH MIDDLEWARE ==========
func authMiddleware(c *fiber.Ctx) error {
	auth := c.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	tokenStr := strings.TrimPrefix(auth, "Bearer ")

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
	}

	claims := token.Claims.(jwt.MapClaims)
	// claims "user_id" stored as float64 by jwt library decode
	uidFloat, ok := claims["user_id"].(float64)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token claims"})
	}
	c.Locals("user_id", int(uidFloat))

	return c.Next()
}

// ========== REGISTER ==========
func registerHandler(c *fiber.Ctx) error {
	var data struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.BodyParser(&data); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}
	if strings.TrimSpace(data.Username) == "" || strings.TrimSpace(data.Password) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Username and password required"})
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(data.Password), 10)

	_, err := db.Exec("INSERT INTO users (username, password_hash) VALUES ($1,$2)",
		data.Username, string(hash))

	if err != nil {
		// likely duplicate username
		return c.Status(400).JSON(fiber.Map{"error": "Username taken"})
	}

	return c.JSON(fiber.Map{"message": "User registered"})
}

// ========== LOGIN ==========
func loginHandler(c *fiber.Ctx) error {
	var data struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.BodyParser(&data); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	var id int
	var hash string
	err := db.QueryRow("SELECT id, password_hash FROM users WHERE username=$1", data.Username).
		Scan(&id, &hash)

	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid username/password"})
	}

	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(data.Password)) != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid username/password"})
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": id,
		"exp":     time.Now().Add(72 * time.Hour).Unix(),
	})

	tokenStr, _ := token.SignedString(jwtSecret)

	return c.JSON(fiber.Map{"token": tokenStr})
}

// ========== NOTES CRUD ==========

type Note struct {
	ID        int        `json:"id"`
	UserID    int        `json:"user_id"`
	Date      *time.Time `json:"date,omitempty"` // pointer so null possible
	Type      string     `json:"type"`
	Content   string     `json:"content"`
	Status    *string    `json:"status,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	CanEdit   bool       `json:"can_edit"`
	IsOwner   bool       `json:"is_owner"`
}

// CREATE
func createNote(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	// Accept flexible payload
	var payload struct {
		Date    string `json:"date"` // expected "YYYY-MM-DD" or empty
		Type    string `json:"type"` // "todo" or "note"
		Content string `json:"content"`
		Status  string `json:"status"` // optional
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	// defaults
	typ := strings.ToLower(strings.TrimSpace(payload.Type))
	if typ != "todo" {
		typ = "note"
	}

	// parse date if provided
	var dateVal interface{} = nil
	if strings.TrimSpace(payload.Date) != "" {
		t, err := time.Parse("2006-01-02", payload.Date)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid date format (use YYYY-MM-DD)"})
		}
		dateVal = t
	}

	// default status for todo
	var statusVal *string
	if typ == "todo" {
		st := strings.TrimSpace(payload.Status)
		if st == "" {
			st = "on_progress"
		}
		statusVal = &st
	} else {
		if strings.TrimSpace(payload.Status) != "" {
			st := strings.TrimSpace(payload.Status)
			statusVal = &st
		}
	}

	// insert
	var id int
	var createdAt time.Time
	if dateVal == nil {
		err := db.QueryRow(
			`INSERT INTO notes (user_id, type, content, status) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
			userID, typ, payload.Content, statusVal,
		).Scan(&id, &createdAt)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "DB error: " + err.Error()})
		}
	} else {
		// date provided: store date (cast to date)
		t := dateVal.(time.Time)
		err := db.QueryRow(
			`INSERT INTO notes (user_id, date, type, content, status) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
			userID, t, typ, payload.Content, statusVal,
		).Scan(&id, &createdAt)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "DB error: " + err.Error()})
		}
	}

	// return created note
	var note Note
	var datePtr *time.Time
	err := db.QueryRow("SELECT id, user_id, date, type, content, status, created_at, updated_at FROM notes WHERE id=$1", id).
		Scan(&note.ID, &note.UserID, &datePtr, &note.Type, &note.Content, &note.Status, &note.CreatedAt, &note.UpdatedAt)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error readback: " + err.Error()})
	}
	note.Date = datePtr

	return c.Status(201).JSON(note)
}

// READ
func getNotes(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	rows, err := db.Query(`
        SELECT n.id, n.user_id, n.date, n.type, n.content, n.status, 
               n.created_at, n.updated_at,
               COALESCE(nc.can_edit, FALSE) AS can_edit
        FROM notes n
        LEFT JOIN note_collaborators nc 
               ON n.id = nc.note_id AND nc.user_id = $1
        WHERE n.user_id = $1 OR nc.user_id = $1
        ORDER BY n.created_at DESC
    `, userID)

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error: " + err.Error()})
	}
	defer rows.Close()

	var list []Note
	for rows.Next() {
		var n Note
		var datePtr *time.Time
		var canEdit bool

		if err := rows.Scan(
			&n.ID, &n.UserID, &datePtr, &n.Type, &n.Content,
			&n.Status, &n.CreatedAt, &n.UpdatedAt, &canEdit,
		); err != nil {
			continue
		}

		n.Date = datePtr
		n.CanEdit = canEdit
		n.IsOwner = (n.UserID == userID)

		list = append(list, n)
	}

	return c.JSON(list)
}

// UPDATE NOTE
func updateNote(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.Atoi(idParam)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid note id"})
	}

	var payload struct {
		Date    string `json:"date"`
		Type    string `json:"type"`
		Content string `json:"content"`
		Status  string `json:"status"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	setParts := []string{}
	args := []interface{}{}
	argIdx := 1

	if strings.TrimSpace(payload.Content) != "" {
		setParts = append(setParts, "content = $"+strconv.Itoa(argIdx))
		args = append(args, payload.Content)
		argIdx++
	}
	if strings.TrimSpace(payload.Type) != "" {
		setParts = append(setParts, "type = $"+strconv.Itoa(argIdx))
		args = append(args, payload.Type)
		argIdx++
	}
	if strings.TrimSpace(payload.Status) != "" {
		setParts = append(setParts, "status = $"+strconv.Itoa(argIdx))
		args = append(args, payload.Status)
		argIdx++
	}
	if strings.TrimSpace(payload.Date) != "" {
		t, _ := time.Parse("2006-01-02", payload.Date)
		setParts = append(setParts, "date = $"+strconv.Itoa(argIdx))
		args = append(args, t)
		argIdx++
	}

	setParts = append(setParts, "updated_at = $"+strconv.Itoa(argIdx))
	args = append(args, time.Now())
	argIdx++

	args = append(args, id)
	query := "UPDATE notes SET " + strings.Join(setParts, ", ") + " WHERE id=$" + strconv.Itoa(argIdx)

	_, err = db.Exec(query, args...)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB update error: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Updated"})
}

// DELETE NOTE
func deleteNote(c *fiber.Ctx) error {
	id := c.Params("id")

	res, err := db.Exec("DELETE FROM notes WHERE id=$1", id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error"})
	}

	aff, _ := res.RowsAffected()
	if aff == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Note not found"})
	}

	return c.JSON(fiber.Map{"message": "Deleted"})
}

// SHARE NOTE -> generate share token and return it
func shareNote(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	noteID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid note ID"})
	}

	// verify note exists and owned by this user (optional) - keep allow owner only for sharing
	var ownerID int
	err = db.QueryRow("SELECT user_id FROM notes WHERE id=$1", noteID).Scan(&ownerID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Note not found"})
	}
	if ownerID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Only owner can generate share token"})
	}

	// generate token
	token := uuid.New().String()

	// save token in note
	_, err = db.Exec("UPDATE notes SET share_token=$1 WHERE id=$2", token, noteID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error: " + err.Error()})
	}

	// also add owner as collaborator (optional), but not necessary
	_, _ = db.Exec("INSERT INTO note_collaborators (note_id, user_id, can_edit) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", noteID, userID, true)

	return c.JSON(fiber.Map{"share_token": token})
}

// JOIN NOTE BY TOKEN
func joinNoteByToken(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	var payload struct {
		Token string `json:"token"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}
	if strings.TrimSpace(payload.Token) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Token required"})
	}

	// find note by token
	var noteID int
	err := db.QueryRow("SELECT id FROM notes WHERE share_token=$1", payload.Token).Scan(&noteID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Note not found for that token"})
	}

	// insert collaborator
	_, err = db.Exec("INSERT INTO note_collaborators (note_id, user_id, can_edit) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", noteID, userID, true)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Joined note successfully", "note_id": noteID})
}

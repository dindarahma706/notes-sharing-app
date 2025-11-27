package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB
var jwtSecret = []byte("secretkey")

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

	app := fiber.New()

	// CORS
	app.Use(func(c *fiber.Ctx) error {
		c.Set("Access-Control-Allow-Origin", "*")
		c.Set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
		c.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Method() == "OPTIONS" {
			return c.SendStatus(200)
		}
		return c.Next()
	})

	// Logging
	app.Use(requestLogger)

	app.Post("/register", registerHandler)
	app.Post("/login", loginHandler)

	notes := app.Group("/notes", authMiddleware)
	notes.Get("/", getNotes)
	notes.Post("/", createNote)
	notes.Delete("/:id", deleteNote)

	log.Println("Server running on port 8000")
	log.Fatal(app.Listen(":8000"))
}

// ========== REQUEST LOGGER ==========
func requestLogger(c *fiber.Ctx) error {
	start := time.Now()

	headers, _ := json.Marshal(c.GetReqHeaders())
	body := c.Body()

	err := c.Next()

	resp := c.Response().Body()
	status := c.Response().StatusCode()

	db.Exec(`
		INSERT INTO logs (datetime, method, endpoint, request_headers, payload, response_body, status_code)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`,
		start, c.Method(), c.Path(), headers, body, resp, status)

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
	c.Locals("user_id", int(claims["user_id"].(float64)))

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

	hash, _ := bcrypt.GenerateFromPassword([]byte(data.Password), 10)

	_, err := db.Exec("INSERT INTO users (username, password_hash) VALUES ($1,$2)",
		data.Username, string(hash))

	if err != nil {
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
	ID      int
	Title   string
	Content string
}

func createNote(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	var n Note
	if err := c.BodyParser(&n); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	err := db.QueryRow(
		"INSERT INTO notes (user_id,title,content) VALUES ($1,$2,$3) RETURNING id",
		userID, n.Title, n.Content,
	).Scan(&n.ID)

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error"})
	}

	return c.JSON(n)
}

func getNotes(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)

	rows, err := db.Query("SELECT id,title,content FROM notes WHERE user_id=$1", userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error"})
	}
	defer rows.Close()

	var list []Note

	for rows.Next() {
		var n Note
		rows.Scan(&n.ID, &n.Title, &n.Content)
		list = append(list, n)
	}

	return c.JSON(list)
}

func deleteNote(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(int)
	id := c.Params("id")

	res, err := db.Exec("DELETE FROM notes WHERE id=$1 AND user_id=$2", id, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "DB error"})
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Note not found"})
	}

	return c.JSON(fiber.Map{"message": "Deleted"})
}

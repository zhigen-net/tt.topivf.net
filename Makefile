dev:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

db-shell:
	docker compose exec postgres psql -U socialhub -d socialhub

redis-cli:
	docker compose exec redis redis-cli -a $(shell grep REDIS_PASSWORD .env | cut -d= -f2)

api-shell:
	docker compose exec api sh

rebuild:
	docker compose up --build --force-recreate

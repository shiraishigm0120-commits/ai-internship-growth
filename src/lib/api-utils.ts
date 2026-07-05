import { NextResponse } from "next/server"

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error"
  return NextResponse.json({ error: message }, { status: 500 })
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 })
}

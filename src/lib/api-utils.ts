import { NextResponse } from "next/server"

export function handleApiError(error: unknown, context?: string) {
  const message = error instanceof Error ? error.message : "Internal server error"
  if (context) {
    console.error(`[${context}]`, error)
  } else {
    console.error(error)
  }
  return NextResponse.json({ error: message }, { status: 500 })
}

export function unauthorized(msg: unknown = "Unauthorized") {
  return NextResponse.json({ error: msg instanceof Error ? msg.message : String(msg ?? "Unauthorized") }, { status: 401 })
}

export function notFound(msg: unknown = "Not found") {
  return NextResponse.json({ error: msg instanceof Error ? msg.message : String(msg ?? "Not found") }, { status: 404 })
}

export function badRequest(msg: unknown = "Bad request") {
  return NextResponse.json({ error: msg instanceof Error ? msg.message : String(msg ?? "Bad request") }, { status: 400 })
}

export function serverError(msg: unknown = "Internal server error") {
  return NextResponse.json({ error: msg instanceof Error ? msg.message : String(msg ?? "Internal server error") }, { status: 500 })
}

export function success(data: unknown) {
  return NextResponse.json({ data })
}

export function created(data: unknown) {
  return NextResponse.json({ data }, { status: 201 })
}

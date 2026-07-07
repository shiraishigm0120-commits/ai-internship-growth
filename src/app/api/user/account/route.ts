import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { handleApiError } from "@/lib/api-utils"

// DELETE /api/user/account — delete account and all user data
export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Delete in dependency order
    await prisma.$transaction([
      // Delete achievement records
      prisma.achievement.deleteMany({
        where: { record: { internship: { userId } } },
      }),
      // Delete work items
      prisma.workItem.deleteMany({
        where: { record: { internship: { userId } } },
      }),
      // Delete knowledge items
      prisma.knowledge.deleteMany({
        where: { record: { internship: { userId } } },
      }),
      // Delete STAR cases
      prisma.sTARCase.deleteMany({
        where: { internship: { userId } },
      }),
      // Delete resume materials
      prisma.resumeMaterial.deleteMany({ where: { internship: { userId } } }),
      // Delete reports
      prisma.report.deleteMany({
        where: { internship: { userId } },
      }),
      // Delete daily records
      prisma.dailyRecord.deleteMany({
        where: { internship: { userId } },
      }),
      // Delete goals
      prisma.goal.deleteMany({ where: { userId } }),
      // Delete tasks
      prisma.task.deleteMany({
        where: { internship: { userId } },
      }),
      // Delete milestones
      prisma.milestone.deleteMany({ where: { userId } }),
      // Delete growth memories
      prisma.growthMemory.deleteMany({ where: { userId } }),
      // Delete skills
      prisma.skill.deleteMany({ where: { userId } }),
      // Delete internships
      prisma.internship.deleteMany({ where: { userId } }),
      // Delete user settings
      prisma.userSettings.deleteMany({ where: { userId } }),
      // Delete sessions and accounts
      prisma.session.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      // Finally delete the user
      prisma.user.delete({ where: { id: userId } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "DELETE /api/user/account")
  }
}

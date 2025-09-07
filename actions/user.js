"use server";

import {auth} from "@clerk/nextjs/server";
import {db} from "@/lib/prisma";
import {generateAIInsights} from "@/actions/dashboard";

export async function updateUser(data) {
    const {userId} = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const user = await db.user.findUnique({
        where: {
            clerkUserId: userId,
        },
    });

    // // Import checkUser function
    // const {checkUser} = await import("@/lib/checkUser");
    // // This will create a user if one doesn't exist
    // const user = await checkUser();

    if (!user) throw new Error("Failed to get or create user");

    try {
        const result = await db.$transaction(async (tx) => {
            // find if the industry exists
            let industryInsight = await tx.industryInsight.findUnique({
                where: {
                    industry: data.industry,
                },
            });
            // If the industry doesn't exist, create it with default values - will replace it with AI later
            if (!industryInsight) {
                const insights = await generateAIInsights(data.industry);
                const normalized = {
                    ...insights,
                    demandLevel: insights?.demandLevel ? String(insights.demandLevel).toUpperCase() : undefined,
                    marketOutlook: insights?.marketOutlook ? String(insights.marketOutlook).toUpperCase() : undefined,
                };

                industryInsight = await tx.industryInsight.create({
                    data: {
                        industry: data.industry,
                        ...normalized,
                        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    },
                });
            }
            // update the user
            const updatedUser = await tx.user.update({
                where: {
                    id: user.id,
                }, data: {
                    industry: data.industry, experience: data.experience, bio: data.bio, skills: data.skills,
                },
            });

            return {updatedUser, industryInsight};
        }, {
            timeout: 10000, // default: 5000
        });
        return {success: true, ...result};
    } catch (error) {
        console.error("Error updating user and industry:", error.message);
        throw new Error("Failed to update profile");
    }
}

export async function getUserOnboardingStatus() {
    const {userId} = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Import checkUser function
    const {checkUser} = await import("@/lib/checkUser");

    // This will create a user if one doesn't exist
    const user = await checkUser();

    if (!user) throw new Error("User not found");

    try {
        return {
            isOnboarded: !!user?.industry,
        };
    } catch (error) {
        console.error("Error checking onboarding status:", error.message);
        throw new Error("Failed to check onboarding status" + error.message);
    }
}

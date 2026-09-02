package com.plantshare.solo.notif

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.plantshare.solo.MainActivity
import com.plantshare.solo.R
import com.plantshare.solo.data.PlantState
import com.plantshare.solo.data.PlantStatus

object Notifications {

    const val CHANNEL_DUE = "watering_due"
    const val CHANNEL_LATE = "watering_late"
    private const val NOTIFICATION_ID = 1001

    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_DUE,
                "Watering reminders",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply { description = "Your evening reminder that plants need water" }
        )
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_LATE,
                "Overdue warnings",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "Warnings for plants that were missed" }
        )
    }

    /** Nothing is posted when [statuses] is empty — a quiet evening stays quiet. */
    @SuppressLint("MissingPermission")
    fun showReminder(context: Context, statuses: List<PlantStatus>) {
        if (statuses.isEmpty()) return
        val manager = NotificationManagerCompat.from(context)
        if (!manager.areNotificationsEnabled()) return

        val worstLate = statuses.filter { it.state == PlantState.LATE }
            .maxOfOrNull { it.daysLate } ?: 0

        val title = when {
            worstLate >= 1 -> {
                val word = if (worstLate == 1) "day" else "days"
                "$worstLate $word late"
            }
            statuses.size == 1 -> "Water ${statuses.first().plant.name} tonight"
            else -> "Water ${statuses.size} plants tonight"
        }

        val lines = statuses.map { status ->
            if (status.state == PlantState.LATE) {
                val d = status.daysLate
                "${status.plant.name} — $d day${if (d == 1) "" else "s"} late"
            } else {
                status.plant.name
            }
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val style = NotificationCompat.InboxStyle().setBigContentTitle(title)
        lines.forEach { style.addLine(it) }

        val notification = NotificationCompat.Builder(
            context,
            if (worstLate >= 1) CHANNEL_LATE else CHANNEL_DUE,
        )
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(lines.joinToString(", "))
            .setStyle(style)
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setPriority(
                if (worstLate >= 1) NotificationCompat.PRIORITY_HIGH
                else NotificationCompat.PRIORITY_DEFAULT
            )
            .build()

        runCatching { manager.notify(NOTIFICATION_ID, notification) }
    }
}

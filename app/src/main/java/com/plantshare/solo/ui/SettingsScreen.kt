package com.plantshare.solo.ui

import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.plantshare.solo.ServiceLocator
import com.plantshare.solo.data.Due
import com.plantshare.solo.data.ReminderSettings
import com.plantshare.solo.work.ReminderScheduler
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val store = remember { ServiceLocator.settingsStore(context) }
    val plants = remember { ServiceLocator.plantStore(context) }
    val settings by store.settings.collectAsState(initial = ReminderSettings())
    val snackbar = remember { SnackbarHostState() }

    var showTimePicker by remember { mutableStateOf(false) }
    var showImport by remember { mutableStateOf(false) }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = settings.enabled) { showTimePicker = true }
                    .padding(vertical = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Reminder time", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "The app wakes once a day at this time to check the list.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(settings.label(), style = MaterialTheme.typography.headlineMedium)
            }

            HorizontalDivider()

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Daily reminders", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "Turn off to stop all notifications.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(
                    checked = settings.enabled,
                    onCheckedChange = { on ->
                        scope.launch {
                            store.setEnabled(on)
                            if (on) ReminderScheduler.schedule(context, settings.hour, settings.minute)
                            else ReminderScheduler.cancel(context)
                        }
                    },
                )
            }

            HorizontalDivider()
            Spacer(Modifier.height(24.dp))

            Text("Backup", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(4.dp))
            Text(
                "Everything lives on this phone only. Export before changing phones, " +
                    "or the list is gone with it.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))

            Row {
                TextButton(onClick = {
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, plants.exportJson())
                    }
                    context.startActivity(Intent.createChooser(send, "Export plants"))
                }) { Text("Export") }

                TextButton(onClick = { showImport = true }) { Text("Import") }
            }

            Spacer(Modifier.height(24.dp))
            Text(
                "Plants that stay unwatered warn you for ${Due.MAX_LATE_WARNINGS} days, " +
                    "then go quiet but stay on the list.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(32.dp))
        }
    }

    if (showTimePicker) {
        val state = rememberTimePickerState(
            initialHour = settings.hour,
            initialMinute = settings.minute,
            is24Hour = true,
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Check the plants at") },
            text = { TimePicker(state = state) },
            confirmButton = {
                TextButton(onClick = {
                    showTimePicker = false
                    scope.launch {
                        store.setTime(state.hour, state.minute)
                        ReminderScheduler.schedule(context, state.hour, state.minute)
                    }
                }) { Text("Save time") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
            },
        )
    }

    if (showImport) {
        var text by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showImport = false },
            title = { Text("Paste a backup") },
            text = {
                Column {
                    Text(
                        "This replaces every plant currently in the app.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = text,
                        onValueChange = { text = it },
                        label = { Text("Backup text") },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 6,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = text.isNotBlank(),
                    onClick = {
                        showImport = false
                        val ok = runCatching { plants.importJson(text) }.isSuccess
                        scope.launch {
                            snackbar.showSnackbar(
                                if (ok) "Backup restored" else "That text isn't a valid backup"
                            )
                        }
                    },
                ) { Text("Replace everything") }
            },
            dismissButton = {
                TextButton(onClick = { showImport = false }) { Text("Cancel") }
            },
        )
    }
}

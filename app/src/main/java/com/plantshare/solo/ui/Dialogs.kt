package com.plantshare.solo.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.plantshare.solo.data.Plant

/**
 * One dialog for adding and editing. When editing, the schedule start question
 * is hidden — the plant already has a countdown running.
 */
@Composable
fun PlantEditorDialog(
    existing: Plant?,
    onDismiss: () -> Unit,
    onSave: (name: String, periodDays: Int, dueToday: Boolean) -> Unit,
    onDelete: (() -> Unit)?,
) {
    var name by remember { mutableStateOf(existing?.name ?: "") }
    var period by remember { mutableStateOf((existing?.periodDays ?: 7).toString()) }
    var dueToday by remember { mutableStateOf(true) }

    val periodValue = period.toIntOrNull() ?: 0
    val valid = name.isNotBlank() && periodValue in 1..365

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "Add a plant" else "Edit plant") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    singleLine = true,
                    label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = period,
                    onValueChange = { period = it.filter(Char::isDigit).take(3) },
                    singleLine = true,
                    label = { Text("Water every … days") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                )

                if (existing == null) {
                    Spacer(Modifier.height(16.dp))
                    Text(
                        "First watering",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = dueToday,
                            onClick = { dueToday = true },
                            label = { Text("Due today") },
                        )
                        FilterChip(
                            selected = !dueToday,
                            onClick = { dueToday = false },
                            label = {
                                Text(
                                    if (periodValue > 0) "In $periodValue days"
                                    else "After one period"
                                )
                            },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(name.trim(), periodValue, dueToday) },
                enabled = valid,
            ) { Text(if (existing == null) "Add plant" else "Save changes") }
        },
        dismissButton = {
            Row {
                if (onDelete != null) {
                    TextButton(onClick = onDelete) {
                        Text("Delete", color = MaterialTheme.colorScheme.error)
                    }
                }
                TextButton(onClick = onDismiss) { Text("Cancel") }
            }
        },
    )
}

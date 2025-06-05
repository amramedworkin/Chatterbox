# clean.ps1
# This script cleans persistent data and/or the 'interactions' folder.
#
# Usage: .\clean.ps1 [options] [filter_parameter]
#
# Options:
#   --help, --?             : Display this help message and exit.
#   --refresh                   : Clears all persistent data files except tokens (e.g., history ID, poll counts, last polled email).
#   --tokens                : Cleans only token files (pollGmail's token.json and sendTestGmail's sendtest_token.json), forcing re-authorization.
#   --all                   : Performs both --refresh and --tokens operations (clears all persistent data and tokens).
#   --keepinteractions      : Prevents deletion of the 'interactions' folder, even if a filter is specified.
#
# Filter Parameter (optional, used if no --refresh/--tokens/--all flags are set, or with --keepinteractions):
#   <string>                : If specified, deletes only subfolders in 'interactions' whose names
#                             start with this string (case-insensitive partial match).
#                             If no flags are set and no filter, performs full interactions folder clean.
#
# Examples:
#   .\clean.ps1 --help
#   .\clean.ps1 --all
#   .\clean.ps1 --refresh
#   .\clean.ps1 --tokens
#   .\clean.ps1                 (Cleans all interactions data)
#   .\clean.ps1 ABC             (Cleans interactions folders starting with 'ABC')
#   .\clean.ps1 --refresh --keepinteractions (Cleans data files, but keeps interactions folder)
#   .\clean.ps1 --all ABC --keepinteractions (Cleans data files, keeps interactions folder, but still searches for 'ABC' if --all wasn't suppressing interaction clean)

# --- Configuration ---
# Base path for persistent data files, relative to this script.
# Assumes this script is at the project root where 'data' also resides.
$DataFolderPath = Join-Path -Path $PSScriptRoot -ChildPath "data"
# Path to the 'interactions' folder, relative to this script.
$InteractionsFolderPath = Join-Path -Path $PSScriptRoot -ChildPath "interactions"

# Paths to persistent files (relative to $DataFolderPath)
$PollGmailTokenFile = Join-Path -Path $DataFolderPath -ChildPath "token.json"
$LastHistoryIdFile = Join-Path -Path $DataFolderPath -ChildPath "last_history_id.txt"
$LastPolledEmailFile = Join-Path -Path $DataFolderPath -ChildPath "last_polled_email.txt"
$TotalPollCyclesFile = Join-Path -Path $DataFolderPath -ChildPath "total_poll_cycles.txt"

$SendTestTokenFile = Join-Path -Path $DataFolderPath -ChildPath "sendtest_token.json"
$SendTestLastSentEmailNumberFile = Join-Path -Path $DataFolderPath -ChildPath "sendtest_last_sent_email_number.txt"
$SendTestSenderEmailFile = Join-Path -Path $DataFolderPath -ChildPath "sendtest_sender_email.txt"
$SendTestRecipientEmailFile = Join-Path -Path $DataFolderPath -ChildPath "sendtest_recipient_email.txt"
$SendTestSendCountFile = Join-Path -Path $DataFolderPath -ChildPath "sendtest_send_count.txt"


# --- Logging Function ---
function Write-Log {
    Param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        [string]$Level = "INFO" # INFO, WARN, ERROR
    )
    $Timestamp = (Get-Date -Format "yyyyMMdd:HHmmss:")
    Write-Host "$Timestamp [$Level] $Message"
}

# --- Help Function ---
function Show-Help {
    Write-Log "--------------------------------------------------------------------------------"
    Write-Log "                           Clean Interactions Script Help                       "
    Write-Log "--------------------------------------------------------------------------------"
    Write-Host "`nUsage: .`\$clean.ps1 [options] [`<filter_parameter`>]"
    Write-Host "`nOptions:"
    Write-Host "  --help, --?             : Display this help message and exit."
    Write-Host "  --refresh               : Clears all persistent data files except tokens. This includes:"
    Write-Host "                            - last_history_id.txt"
    Write-Host "                            - last_polled_email.txt"
    Write-Host "                            - total_poll_cycles.txt"
    Write-Host "                            - sendtest_last_sent_email_number.txt"
    Write-Host "                            - sendtest_sender_email.txt"
    Write-Host "                            - sendtest_recipient_email.txt"
    Write-Host "                            - sendtest_send_count.txt"
    Write-Host "                            Requires re-authorization on next run of pollGmail.js if tokens are not cleared."
    Write-Host "  --tokens                : Cleans only token files. This includes:"
    Write-Host "                            - token.json (for pollGmail.js)"
    Write-Host "                            - sendtest_token.json (for sendTestGmail.js)"
    Write-Host "                            Forces re-authorization on next run of pollGmail.js/sendTestGmail.js."
    Write-Host "  --all                   : Performs both --refresh and --tokens operations (clears all persistent data and tokens)."
    Write-Host "  --keepinteractions      : Prevents deletion of the 'interactions' folder. Can be used with --refresh, --tokens, or --all."
    Write-Host "`nFilter Parameter (optional, used if no --refresh/--tokens/--all flags are set, or with --keepinteractions):"
    Write-Host "  `<string>`              : If specified, deletes only subfolders in 'interactions' whose names"
    Write-Host "                            start with this string (case-insensitive partial match)."
    Write-Host "                              If no options are set and no filter, performs full interactions folder clean."
    Write-Host "`nExamples:"
    Write-Host "  clean.ps1 --help"
    Write-Host "  clean.ps1 --all"
    Write-Host "  clean.ps1 --refresh"
    Write-Host "  clean.ps1 --tokens"
    Write-Host "  clean.ps1                 (Cleans all interactions folder contents by default)"
    Write-Host "  clean.ps1 ABC             (Cleans interactions folders starting with 'ABC')"
    Write-Host "  clean.ps1 --refresh --keepinteractions (Cleans data files, but keeps interactions folder)"
    Write-Host "  clean.ps1 --tokens --keepinteractions (Cleans token files, but keeps interactions folder)"
    Write-Log "------------------------------------------------------------------------"
    exit 0
}

# --- Argument Parsing ---
$CleanNewData = $false
$CleanTokens = $false
$CleanAllInteractionsFolder = $false # Default behavior if no flags, no filter
$KeepInteractions = $false # Flag to override interaction cleaning

$FilterParameter = "" # To capture the non-flag argument

$Args | ForEach-Object {
    if ($_ -eq "--help" -or $_ -eq "-?") {
        Show-Help
    } elseif ($_ -eq "--refresh") {
        $CleanNewData = $true
    } elseif ($_ -eq "--tokens") {
        $CleanTokens = $true
    } elseif ($_ -eq "--all") {
        $CleanNewData = $true
        $CleanTokens = $true
    } elseif ($_ -eq "--keepinteractions") {
        $KeepInteractions = $true
    } else {
        # Assuming any other argument is the filter parameter
        $FilterParameter = $_
    }
}

# Determine default interaction folder cleaning behavior if no specific flags were set
if (-not $CleanNewData -and -not $CleanTokens -and -not $KeepInteractions -and [string]::IsNullOrEmpty($FilterParameter)) {
    $CleanAllInteractionsFolder = $true
}


# --- Main Logic ---
Write-Log "Starting Interactions Folder Cleanup Script."
Write-Log "Data folder path: $DataFolderPath"
Write-Log "Interactions folder path: $InteractionsFolderPath"

# Check if data folder exists
if (-not (Test-Path -Path $DataFolderPath -PathType Container)) {
    Write-Log "INFO: The 'data' folder was not found at '$DataFolderPath'. Skipping data file cleanup." "INFO"
}

# Check if interactions folder exists
if (-not (Test-Path -Path $InteractionsFolderPath -PathType Container)) {
    Write-Log "INFO: The 'interactions' folder was not found at '$InteractionsFolderPath'. Skipping interactions folder cleanup." "INFO"
    $CleanAllInteractionsFolder = $false # Ensure this doesn't cause issues if folder doesn't exist
    $KeepInteractions = $true # Treat as if interactions are kept if folder doesn't exist
}


# --- Perform Data File Cleaning ---
if ($CleanNewData -or $CleanTokens) {
    Write-Log "Initiating persistent data file cleanup based on flags."

    $FilesToClean = @()

    if ($CleanNewData) {
        $FilesToClean += $LastHistoryIdFile, $LastPolledEmailFile, $TotalPollCyclesFile
        $FilesToClean += $SendTestLastSentEmailNumberFile, $SendTestSenderEmailFile, $SendTestRecipientEmailFile, $SendTestSendCountFile
    }

    if ($CleanTokens) {
        $FilesToClean += $PollGmailTokenFile, $SendTestTokenFile
    }

    foreach ($FilePath in $FilesToClean) {
        if (Test-Path -Path $FilePath -PathType Leaf) {
            Write-Log "Deleting file: '$FilePath'..."
            try {
                Remove-Item -Path $FilePath -Force -ErrorAction Stop
                Write-Log "SUCCESS: Deleted '$FilePath'." "INFO"
            }
            catch {
                Write-Log "ERROR: Failed to delete '$FilePath'. Error: $_" "ERROR"
            }
        } else {
            Write-Log "INFO: File not found: '$FilePath'. Skipping deletion." "INFO"
        }
    }
}


# --- Perform Interactions Folder Cleaning ---
if (-not $KeepInteractions) {
    if ($CleanAllInteractionsFolder) {
        # --- No parameter specified: Clean all interactions ---
        Write-Log "No specific filter or data flags set. All contents of '$InteractionsFolderPath' will be deleted."
        Write-Log "WARNING: This action is irreversible. Press 'Y' to confirm or 'N' to cancel." "WARN"
        $Confirmation = Read-Host "Confirm (Y/N)"

        if ($Confirmation -eq "Y") {
            Write-Log "Proceeding with full cleanup of '$InteractionsFolderPath'..."
            try {
                Get-ChildItem -Path $InteractionsFolderPath -Force | Remove-Item -Recurse -Force -ErrorAction Stop
                Write-Log "SUCCESS: All contents of '$InteractionsFolderPath' have been deleted." "INFO"
            }
            catch {
                Write-Log "ERROR: Failed to delete contents of '$InteractionsFolderPath'. Error: $_" "ERROR"
                exit 1
            }
        } else {
            Write-Log "Cleanup cancelled by user." "INFO"
        }
    } elseif ([string]::IsNullOrEmpty($FilterParameter) -and -not $CleanNewData -and -not $CleanTokens) {
        # This case handles scenarios where only --keepinteractions might be passed
        # and no other cleanup is intended, but we are in the -not $KeepInteractions block.
        # It's a bit of a logical fall-through, safer to re-evaluate conditions
        # if the goal is only to delete interactions with a filter.
        Write-Log "No action specified for interaction folder cleanup (e.g., neither --refresh nor --tokens, nor filter). Skipping interaction folder deletion." "INFO"
    } else {
        # --- Parameter specified: Clean specific interactions ---
        Write-Log "Parameter specified: '$FilterParameter'. Searching for folders starting with this name."

        $FoldersToDelete = @()
        try {
            $AllSubFolders = Get-ChildItem -Path $InteractionsFolderPath -Directory -ErrorAction Stop
            $FoldersToDelete = $AllSubFolders | Where-Object { $_.Name -like "$FilterParameter*" }
        }
        catch {
            Write-Log "ERROR: Failed to list subfolders in '$InteractionsFolderPath'. Error: $_" "ERROR"
            exit 1
        }

        if ($FoldersToDelete.Count -eq 0) {
            Write-Log "No folders found matching the filter '$FilterParameter' in '$InteractionsFolderPath'." "INFO"
        } else {
            Write-Log "Found $($FoldersToDelete.Count) folder(s) matching '$FilterParameter':"
            $FoldersToDelete | ForEach-Object { Write-Log "  - $($_.Name)" }

            Write-Log "WARNING: These folders and their contents will be permanently deleted. Press 'Y' to confirm or 'N' to cancel." "WARN"
            $Confirmation = Read-Host "Confirm (Y/N)"

            if ($Confirmation -eq "Y") {
                foreach ($Folder in $FoldersToDelete) {
                    $FolderPathToDelete = $Folder.FullName
                    Write-Log "Deleting folder: '$FolderPathToDelete'..."
                    try {
                        Remove-Item -Path $FolderPathToDelete -Recurse -Force -ErrorAction Stop
                        Write-Log "SUCCESS: Deleted '$Folder'." "INFO"
                    }
                    catch {
                        Write-Log "ERROR: Failed to delete folder '$Folder'. Error: $_" "ERROR"
                    }
                }
            } else {
                Write-Log "Cleanup cancelled by user." "INFO"
            }
        }
    }
} else {
    Write-Log "Interactions folder cleanup skipped (--keepinteractions flag or folder not found)." "INFO"
}

Write-Log "Script finished." "INFO"

param(
    [string]$ApiBaseUrl = "http://localhost:8888",
    [int]$SeasonYear = 2026,
    [int]$TotalRequests = 120,
    [string]$UserId = "test",
    [string]$Password = "test123",
    [string]$OutputRoot = ".\seed-output"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

function Write-Step {
    param([string]$Message)
    Write-Host ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message)
}

function Invoke-DevLogin {
    param(
        [string]$BaseUrl,
        [string]$LoginUser,
        [string]$LoginPassword
    )

    $uri = "$BaseUrl/api/LocalAuth/DevLogin"
    $payload = @{
        userId   = $LoginUser
        password = $LoginPassword
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Body $payload
    if (-not $response.isSuccess -or -not $response.data -or -not $response.data.token) {
        $errors = @()
        if ($response.errors) {
            $errors = $response.errors | ForEach-Object { $_.message }
        }
        throw ("DevLogin failed. " + ($errors -join " | "))
    }

    return [string]$response.data.token
}

function Get-AuthHeaders {
    param([string]$Token)
    return @{
        Authorization = "Bearer $Token"
    }
}

function Add-StringPart {
    param(
        [System.Net.Http.MultipartFormDataContent]$Content,
        [string]$Name,
        [string]$Value
    )
    $part = New-Object System.Net.Http.StringContent($Value, [System.Text.Encoding]::UTF8)
    $null = $Content.Add($part, $Name)
}

function Invoke-CreateRequestApi {
    param(
        [string]$BaseUrl,
        [string]$Token,
        [hashtable]$Request
    )

    $handler = New-Object System.Net.Http.HttpClientHandler
    $client = New-Object System.Net.Http.HttpClient($handler)
    try {
        $client.BaseAddress = [Uri]$BaseUrl
        $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $Token)
        $client.DefaultRequestHeaders.Accept.Clear()
        $null = $client.DefaultRequestHeaders.Accept.Add([System.Net.Http.Headers.MediaTypeWithQualityHeaderValue]::new("text/plain"))

        $content = New-Object System.Net.Http.MultipartFormDataContent
        try {
            Add-StringPart -Content $content -Name "MessageId" -Value "0"
            Add-StringPart -Content $content -Name "RequestRef" -Value ([string]$Request.RequestRefSeed)
            Add-StringPart -Content $content -Name "Subject" -Value ([string]$Request.Subject)
            Add-StringPart -Content $content -Name "Description" -Value ([string]$Request.Description)
            Add-StringPart -Content $content -Name "CreatedBy" -Value ([string]$Request.CreatedBy)
            Add-StringPart -Content $content -Name "AssignedSectorId" -Value ""
            Add-StringPart -Content $content -Name "UnitId" -Value "0"
            Add-StringPart -Content $content -Name "CurrentResponsibleSectorId" -Value ""
            Add-StringPart -Content $content -Name "Type" -Value "0"
            Add-StringPart -Content $content -Name "CategoryCd" -Value ([string]$Request.CategoryId)

            for ($i = 0; $i -lt $Request.Fields.Count; $i += 1) {
                $field = $Request.Fields[$i]
                Add-StringPart -Content $content -Name ("Fields[{0}].fildSql" -f $i) -Value ([string]$field.fildSql)
                Add-StringPart -Content $content -Name ("Fields[{0}].fildRelted" -f $i) -Value ([string]$field.fildRelted)
                Add-StringPart -Content $content -Name ("Fields[{0}].fildKind" -f $i) -Value ([string]$field.fildKind)
                Add-StringPart -Content $content -Name ("Fields[{0}].fildTxt" -f $i) -Value ([string]$field.fildTxt)
                Add-StringPart -Content $content -Name ("Fields[{0}].instanceGroupId" -f $i) -Value ([string]$field.instanceGroupId)
            }

            $httpResponse = $client.PostAsync("/api/DynamicForm/CreateRequest", $content).GetAwaiter().GetResult()
            $raw = $httpResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            if ([string]::IsNullOrWhiteSpace($raw)) {
                throw "CreateRequest returned empty response."
            }

            $json = $raw | ConvertFrom-Json
            return $json
        }
        finally {
            $content.Dispose()
        }
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Get-WaveCapacityRows {
    param(
        [string]$BaseUrl,
        [string]$Token,
        [int]$CategoryId,
        [string]$WaveCode
    )

    $headers = Get-AuthHeaders -Token $Token
    $uri = "$BaseUrl/api/SummerWorkflow/GetWaveCapacity?categoryId=$CategoryId&waveCode=$WaveCode"
    $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    if (-not $response.isSuccess) {
        return @()
    }
    if (-not $response.data) {
        return @()
    }
    return @($response.data)
}

function Get-CapacitySnapshot {
    param(
        [string]$BaseUrl,
        [string]$Token,
        [array]$Destinations
    )

    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($destination in $Destinations) {
        foreach ($wave in $destination.Waves) {
            $capacityRows = Get-WaveCapacityRows -BaseUrl $BaseUrl -Token $Token -CategoryId $destination.CategoryId -WaveCode $wave.Code
            foreach ($cap in $capacityRows) {
                $rows.Add([pscustomobject]@{
                    CategoryId     = [int]$destination.CategoryId
                    Destination    = [string]$destination.Name
                    WaveCode       = [string]$wave.Code
                    FamilyCount    = [int]$cap.familyCount
                    TotalUnits     = [int]$cap.totalUnits
                    UsedUnits      = [int]$cap.usedUnits
                    AvailableUnits = [int]$cap.availableUnits
                }) | Out-Null
            }
        }
    }
    return $rows
}

function New-NationalId {
    param([int64]$Seed)
    $base = 70000000000000L + ($Seed % 2999999999999L)
    return ("{0:D14}" -f $base)
}

function New-Phone {
    param([int]$Seed)
    $num = 100000000 + ($Seed % 899999999)
    return ("01{0:D9}" -f $num)
}

function Build-Fields {
    param(
        [object]$Destination,
        [object]$Wave,
        [object]$Employee,
        [int]$FamilyCount,
        [int]$ExtraCount,
        [string]$StayMode,
        [bool]$ProxyMode,
        [int]$Season,
        [string]$Notes,
        [int]$RequestIndex
    )

    $fields = New-Object System.Collections.Generic.List[object]
    $fieldSql = 1
    function Add-Field {
        param([string]$Kind, [string]$Value, [int]$InstanceGroupId = 1)
        $currentFieldSql = $fieldSql
        $fields.Add([pscustomobject]@{
            fildSql        = $currentFieldSql
            fildRelted     = 0
            fildKind       = $Kind
            fildTxt        = $Value
            instanceGroupId = $InstanceGroupId
        }) | Out-Null
        Set-Variable -Name fieldSql -Value ($currentFieldSql + 1) -Scope 1
    }

    Add-Field -Kind "RequestRef" -Value ("SEED-{0:D4}" -f $RequestIndex)
    Add-Field -Kind "Subject" -Value ("Seed Summer Request {0:D4}" -f $RequestIndex)
    Add-Field -Kind "Emp_Name" -Value $Employee.Name
    Add-Field -Kind "Emp_Id" -Value $Employee.FileNo
    Add-Field -Kind "NationalId" -Value $Employee.NationalId
    Add-Field -Kind "PhoneNumber" -Value $Employee.Phone
    Add-Field -Kind "ExtraPhoneNumber" -Value $Employee.ExtraPhone
    Add-Field -Kind "SummerCamp" -Value $Wave.Code
    Add-Field -Kind "SummerCampLabel" -Value $Wave.Label
    Add-Field -Kind "SummerSeasonYear" -Value ([string]$Season)
    Add-Field -Kind "FamilyCount" -Value ([string]$FamilyCount)
    Add-Field -Kind "Over_Count" -Value ([string]$ExtraCount)
    Add-Field -Kind "SummerStayMode" -Value $StayMode
    Add-Field -Kind "SummerDestinationId" -Value ([string]$Destination.CategoryId)
    Add-Field -Kind "SummerDestinationName" -Value $Destination.Name
    Add-Field -Kind "SummerProxyMode" -Value ($(if ($ProxyMode) { "1" } else { "0" }))
    Add-Field -Kind "Description" -Value $Notes

    $relations = @("Spouse", "Son", "Daughter", "Father", "Mother", "Brother", "Sister")
    $companionsCount = [Math]::Max(0, $FamilyCount + $ExtraCount - 1)
    for ($i = 1; $i -le $companionsCount; $i += 1) {
        $relation = $relations[($i + $RequestIndex) % $relations.Count]
        $companionName = "Companion $RequestIndex-$i"
        $companionNid = New-NationalId -Seed ([int64]($RequestIndex * 100 + $i))

        Add-Field -Kind "FamilyMember_Name" -Value $companionName -InstanceGroupId $i
        Add-Field -Kind "FamilyRelation" -Value $relation -InstanceGroupId $i
        Add-Field -Kind "FamilyMember_NationalId" -Value $companionNid -InstanceGroupId $i

        if ($relation -eq "Son" -or $relation -eq "Daughter") {
            $age = 3 + (($RequestIndex + $i) % 14)
            Add-Field -Kind "FamilyMember_Age" -Value ([string]$age) -InstanceGroupId $i
        }
    }

    return $fields
}

function Convert-CapacityDelta {
    param(
        [array]$BeforeRows,
        [array]$AfterRows
    )

    $beforeMap = @{}
    foreach ($row in $BeforeRows) {
        $key = "{0}|{1}|{2}" -f $row.CategoryId, $row.WaveCode, $row.FamilyCount
        $beforeMap[$key] = $row
    }

    $afterMap = @{}
    foreach ($row in $AfterRows) {
        $key = "{0}|{1}|{2}" -f $row.CategoryId, $row.WaveCode, $row.FamilyCount
        $afterMap[$key] = $row
    }

    $keys = New-Object System.Collections.Generic.HashSet[string]
    foreach ($k in $beforeMap.Keys) { $null = $keys.Add($k) }
    foreach ($k in $afterMap.Keys) { $null = $keys.Add($k) }

    $delta = New-Object System.Collections.Generic.List[object]
    foreach ($key in $keys) {
        $b = $null
        $a = $null
        if ($beforeMap.ContainsKey($key)) { $b = $beforeMap[$key] }
        if ($afterMap.ContainsKey($key)) { $a = $afterMap[$key] }

        $categoryId = if ($a) { $a.CategoryId } else { $b.CategoryId }
        $destination = if ($a) { $a.Destination } else { $b.Destination }
        $waveCode = if ($a) { $a.WaveCode } else { $b.WaveCode }
        $familyCount = if ($a) { $a.FamilyCount } else { $b.FamilyCount }

        $beforeUsed = if ($b) { [int]$b.UsedUnits } else { 0 }
        $afterUsed = if ($a) { [int]$a.UsedUnits } else { 0 }
        $beforeAvail = if ($b) { [int]$b.AvailableUnits } else { 0 }
        $afterAvail = if ($a) { [int]$a.AvailableUnits } else { 0 }

        $delta.Add([pscustomobject]@{
            CategoryId      = $categoryId
            Destination     = $destination
            WaveCode        = $waveCode
            FamilyCount     = $familyCount
            BeforeUsed      = $beforeUsed
            AfterUsed       = $afterUsed
            UsedDelta       = ($afterUsed - $beforeUsed)
            BeforeAvailable = $beforeAvail
            AfterAvailable  = $afterAvail
            AvailableDelta  = ($afterAvail - $beforeAvail)
        }) | Out-Null
    }

    return $delta
}

$sharedWaveDates = @{
    W01 = "07/06/2026"; W02 = "11/06/2026"; W03 = "21/06/2026"; W04 = "22/06/2026";
    W05 = "05/07/2026"; W06 = "12/07/2026"; W07 = "11/07/2026"; W08 = "26/07/2026";
    W09 = "02/02/2026"; W10 = "01/02/2026"; W11 = "16/02/2026"; W12 = "22/02/2026";
    W13 = "20/02/2026"; W14 = "06/01/2026"; W15 = "12/01/2026"; W16 = "20/01/2026"
}

$matrouhWaveDates = @{
    W01 = "01/06/2026"; W02 = "11/06/2026"; W03 = "12/06/2026"; W04 = "25/06/2026";
    W05 = "02/07/2026"; W06 = "01/07/2026"; W07 = "16/07/2026"; W08 = "22/07/2026";
    W09 = "20/07/2026"; W10 = "06/02/2026"; W11 = "12/02/2026"; W12 = "20/02/2026";
    W13 = "27/02/2026"; W14 = "02/01/2026"; W15 = "10/01/2026"; W16 = "17/01/2026"
}

function New-Waves {
    param([hashtable]$DateMap)
    $waves = New-Object System.Collections.Generic.List[object]
    foreach ($code in @("W01","W02","W03","W04","W05","W06","W07","W08","W09","W10","W11","W12","W13","W14","W15","W16")) {
        $waves.Add([pscustomobject]@{
            Code  = $code
            Label = ("{0} - {1}" -f $code, $DateMap[$code])
        }) | Out-Null
    }
    return $waves
}

$destinations = @(
    @{
        CategoryId    = 147
        Code          = "M"
        Name          = "Matrouh"
        StayModes     = @("RESIDENCE_ONLY", "RESIDENCE_WITH_TRANSPORT")
        FamilyOptions = @(5, 6, 8, 9)
        MaxExtra      = 2
        Waves         = New-Waves -DateMap $matrouhWaveDates
    },
    @{
        CategoryId    = 148
        Code          = "R"
        Name          = "RasElBar"
        StayModes     = @("RESIDENCE_WITH_TRANSPORT")
        FamilyOptions = @(2, 4, 6)
        MaxExtra      = 1
        Waves         = New-Waves -DateMap $sharedWaveDates
    },
    @{
        CategoryId    = 149
        Code          = "B"
        Name          = "PortFouad"
        StayModes     = @("RESIDENCE_ONLY", "RESIDENCE_WITH_TRANSPORT")
        FamilyOptions = @(4, 6, 7)
        MaxExtra      = 2
        Waves         = New-Waves -DateMap $sharedWaveDates
    }
)

Write-Step "Logging in using LocalAuth/DevLogin ..."
$token = Invoke-DevLogin -BaseUrl $ApiBaseUrl -LoginUser $UserId -LoginPassword $Password
Write-Step "Login succeeded."

Write-Step "Capturing capacity snapshot BEFORE seeding ..."
$beforeSnapshot = Get-CapacitySnapshot -BaseUrl $ApiBaseUrl -Token $token -Destinations $destinations

$slots = New-Object System.Collections.Generic.List[object]
foreach ($destination in $destinations) {
    foreach ($wave in $destination.Waves) {
        foreach ($family in $destination.FamilyOptions) {
            $slots.Add([pscustomobject]@{
                Destination = $destination
                Wave        = $wave
                FamilyCount = [int]$family
            }) | Out-Null
        }
    }
}

$rand = New-Object System.Random
$shuffledSlots = @($slots | Sort-Object { $rand.Next() })

$createdRows = New-Object System.Collections.Generic.List[object]
$failedRows = New-Object System.Collections.Generic.List[object]

$attempt = 0
$maxAttempts = $TotalRequests * 30
$slotIndex = 0
$seedSerial = [int](Get-Date -Format "MMddHHmm")

Write-Step ("Starting seed create loop. Target requests: {0}" -f $TotalRequests)
while ($createdRows.Count -lt $TotalRequests -and $attempt -lt $maxAttempts) {
    $attempt += 1
    $slot = $shuffledSlots[$slotIndex % $shuffledSlots.Count]
    $slotIndex += 1

    $destination = $slot.Destination
    $wave = $slot.Wave
    $familyCount = [int]$slot.FamilyCount
    $maxFamily = ($destination.FamilyOptions | Measure-Object -Maximum).Maximum

    $currentCapRows = Get-WaveCapacityRows -BaseUrl $ApiBaseUrl -Token $token -CategoryId $destination.CategoryId -WaveCode $wave.Code
    $familyCap = $currentCapRows | Where-Object { [int]$_.familyCount -eq $familyCount } | Select-Object -First 1
    if (-not $familyCap -or [int]$familyCap.availableUnits -le 0) {
        continue
    }

    $enableExtra = ($familyCount -eq $maxFamily)
    $extraCount = 0
    if ($enableExtra -and $destination.MaxExtra -gt 0) {
        if ($rand.NextDouble() -lt 0.35) {
            $extraCount = $rand.Next(0, $destination.MaxExtra + 1)
        }
    }

    $ordinal = $createdRows.Count + $failedRows.Count + 1
    $employeeNo = "SEED{0:D6}" -f ($seedSerial + $ordinal)
    $employeeName = "Seed Employee {0:D3}" -f $ordinal
    $nationalId = New-NationalId -Seed ([int64]($seedSerial * 1000 + $ordinal))
    $phone = New-Phone -Seed ($seedSerial * 100 + $ordinal)
    $extraPhone = New-Phone -Seed ($seedSerial * 100 + $ordinal + 5000)
    $stayMode = $destination.StayModes[$rand.Next(0, $destination.StayModes.Count)]
    $proxyMode = $true
    $notes = "API seed load test request $ordinal"

    $employee = @{
        Name       = $employeeName
        FileNo     = $employeeNo
        NationalId = $nationalId
        Phone      = $phone
        ExtraPhone = $extraPhone
    }

    $fields = Build-Fields `
        -Destination $destination `
        -Wave $wave `
        -Employee $employee `
        -FamilyCount $familyCount `
        -ExtraCount $extraCount `
        -StayMode $stayMode `
        -ProxyMode $proxyMode `
        -Season $SeasonYear `
        -Notes $notes `
        -RequestIndex $ordinal

    $requestPayload = @{
        RequestRefSeed = ("SEED-{0}-{1:D4}" -f $destination.Code, $ordinal)
        Subject        = ("Summer Seed Request {0:D4}" -f $ordinal)
        Description    = $notes
        CreatedBy      = $UserId
        CategoryId     = [int]$destination.CategoryId
        Fields         = $fields
    }

    $result = $null
    try {
        $result = Invoke-CreateRequestApi -BaseUrl $ApiBaseUrl -Token $token -Request $requestPayload
    }
    catch {
        if ($failedRows.Count -lt 5) {
            Write-Step ("CreateRequest exception for {0}/{1} family {2}: {3}" -f $destination.Name, $wave.Code, $familyCount, $_.Exception.Message)
        }
        $failedRows.Add([pscustomobject]@{
            Attempt      = $attempt
            CategoryId   = $destination.CategoryId
            Destination  = $destination.Name
            WaveCode     = $wave.Code
            FamilyCount  = $familyCount
            EmployeeNo   = $employeeNo
            ErrorMessage = $_.Exception.Message
        }) | Out-Null
        continue
    }

    if ($result -and $result.isSuccess) {
        $messageId = 0
        $requestRef = ""
        $status = ""
        if ($result.data) {
            if ($result.data.messageId) { $messageId = [int]$result.data.messageId }
            if ($result.data.requestRef) { $requestRef = [string]$result.data.requestRef }
            if ($result.data.status) { $status = [string]$result.data.status }
        }

        $createdRows.Add([pscustomobject]@{
            SeedIndex    = $createdRows.Count + 1
            MessageId    = $messageId
            RequestRef   = $requestRef
            CategoryId   = $destination.CategoryId
            Destination  = $destination.Name
            WaveCode     = $wave.Code
            FamilyCount  = $familyCount
            ExtraCount   = $extraCount
            StayMode     = $stayMode
            EmployeeNo   = $employeeNo
            NationalId   = $nationalId
            Phone        = $phone
            CreatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
            Status       = $status
        }) | Out-Null

        if ($createdRows.Count % 10 -eq 0 -or $createdRows.Count -eq $TotalRequests) {
            Write-Step ("Created {0}/{1} requests..." -f $createdRows.Count, $TotalRequests)
        }
    }
    else {
        $errors = @()
        if ($result -and $result.errors) {
            $errors = $result.errors | ForEach-Object { $_.message }
        }
        if ($failedRows.Count -lt 5) {
            Write-Step ("CreateRequest rejected for {0}/{1} family {2}: {3}" -f $destination.Name, $wave.Code, $familyCount, ($errors -join " | "))
        }
        $failedRows.Add([pscustomobject]@{
            Attempt      = $attempt
            CategoryId   = $destination.CategoryId
            Destination  = $destination.Name
            WaveCode     = $wave.Code
            FamilyCount  = $familyCount
            EmployeeNo   = $employeeNo
            ErrorMessage = ($errors -join " | ")
        }) | Out-Null
    }
}

if ($createdRows.Count -lt $TotalRequests) {
    Write-Step ("WARNING: requested {0} but created {1}. Check failed report." -f $TotalRequests, $createdRows.Count)
}
else {
    Write-Step ("Create loop finished successfully: {0} requests created." -f $createdRows.Count)
}

Write-Step "Capturing capacity snapshot AFTER seeding ..."
$afterSnapshot = Get-CapacitySnapshot -BaseUrl $ApiBaseUrl -Token $token -Destinations $destinations
$deltaSnapshot = Convert-CapacityDelta -BeforeRows @($beforeSnapshot) -AfterRows @($afterSnapshot)

$runStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputDir = Join-Path $OutputRoot ("summer_seed_{0}" -f $runStamp)
$null = New-Item -ItemType Directory -Path $outputDir -Force

$beforeCsv = Join-Path $outputDir "capacity_before.csv"
$afterCsv = Join-Path $outputDir "capacity_after.csv"
$deltaCsv = Join-Path $outputDir "capacity_delta.csv"
$createdCsv = Join-Path $outputDir "created_requests.csv"
$failedCsv = Join-Path $outputDir "failed_requests.csv"
$summaryJson = Join-Path $outputDir "summary.json"

@($beforeSnapshot) | Sort-Object CategoryId, WaveCode, FamilyCount | Export-Csv -Path $beforeCsv -NoTypeInformation -Encoding UTF8
@($afterSnapshot) | Sort-Object CategoryId, WaveCode, FamilyCount | Export-Csv -Path $afterCsv -NoTypeInformation -Encoding UTF8
@($deltaSnapshot) | Sort-Object CategoryId, WaveCode, FamilyCount | Export-Csv -Path $deltaCsv -NoTypeInformation -Encoding UTF8
$createdRows.ToArray() | Export-Csv -Path $createdCsv -NoTypeInformation -Encoding UTF8
$failedRows.ToArray() | Export-Csv -Path $failedCsv -NoTypeInformation -Encoding UTF8

$summary = [pscustomobject]@{
    apiBaseUrl       = $ApiBaseUrl
    seasonYear       = $SeasonYear
    requestedCount   = $TotalRequests
    createdCount     = $createdRows.Count
    failedCount      = $failedRows.Count
    startedAtUtc     = (Get-Date).ToUniversalTime().ToString("o")
    outputDirectory  = (Resolve-Path $outputDir).Path
    files            = [pscustomobject]@{
        capacityBefore = (Resolve-Path $beforeCsv).Path
        capacityAfter  = (Resolve-Path $afterCsv).Path
        capacityDelta  = (Resolve-Path $deltaCsv).Path
        created        = (Resolve-Path $createdCsv).Path
        failed         = (Resolve-Path $failedCsv).Path
    }
}

$summary | ConvertTo-Json -Depth 6 | Set-Content -Path $summaryJson -Encoding UTF8

Write-Step ("Done. Output folder: {0}" -f (Resolve-Path $outputDir).Path)
Write-Host ("Created: {0}, Failed: {1}" -f $createdRows.Count, $failedRows.Count)

$ErrorActionPreference = 'Stop'

$baseUrl = if ($env:SALESBOAT_ADMIN_BASE_URL) { $env:SALESBOAT_ADMIN_BASE_URL } else { 'http://127.0.0.1:8080' }
$modelId = '951'
$sourceRoot = 'D:\Threejs\SalesBoat\gltf\951'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )

  $request = @{
    Uri        = $Uri
    Method     = $Method
    WebSession = $session
  }

  if ($null -ne $Body) {
    $request.ContentType = 'application/json'
    $request.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  $response = Invoke-WebRequest -UseBasicParsing @request
  if ([string]::IsNullOrWhiteSpace($response.Content)) {
    return $null
  }

  return $response.Content | ConvertFrom-Json
}

function Upload-Files {
  param(
    [string]$Subdir,
    [string[]]$FilePaths
  )

  Add-Type -AssemblyName System.Net.Http
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.UseCookies = $true
  $handler.CookieContainer = [System.Net.CookieContainer]::new()
  foreach ($cookie in $session.Cookies.GetCookies($baseUrl)) {
    $handler.CookieContainer.Add([Uri]$baseUrl, $cookie)
  }
  $client = [System.Net.Http.HttpClient]::new($handler)

  $content = [System.Net.Http.MultipartFormDataContent]::new()
  $content.Add([System.Net.Http.StringContent]::new($modelId), 'modelId')
  $content.Add([System.Net.Http.StringContent]::new($Subdir), 'subdir')
  $content.Add([System.Net.Http.StringContent]::new('true'), 'replace')

  $streams = @()
  foreach ($path in $FilePaths) {
    $absolutePath = Join-Path $sourceRoot $path
    $stream = [System.IO.File]::OpenRead($absolutePath)
    $streams += $stream
    $fileContent = [System.Net.Http.StreamContent]::new($stream)
    $content.Add($fileContent, 'files', [System.IO.Path]::GetFileName($absolutePath))
  }

  try {
    $response = $client.PostAsync("$baseUrl/api/admin/models/upload", $content).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) {
      throw "upload failed for ${Subdir}: $($response.StatusCode) $body"
    }
    return $body | ConvertFrom-Json
  } finally {
    foreach ($stream in $streams) {
      $stream.Dispose()
    }
    $client.Dispose()
    $handler.Dispose()
    $content.Dispose()
  }
}

Invoke-JsonRequest -Method 'POST' -Uri "$baseUrl/api/admin/auth/login" -Body @{
  email = 'display@preview.com'
  password = 'cqjscb2026'
} | Out-Null

$uploadGroups = @(
  @{ subdir = '951NS'; files = @('951NS/950ns.fbx', '951NS/950ns.glb', '951NS/950ns.glb.log') },
  @{ subdir = '951NS/cc'; files = @(
      '951NS/cc/AO.png',
      '951NS/cc/ccuv_01 - Default_BaseColor.png',
      '951NS/cc/ccuv_01 - Default_Emissive.png',
      '951NS/cc/ccuv_01 - Default_Metallic.png',
      '951NS/cc/ccuv_01 - Default_Normal.png',
      '951NS/cc/ccuv_01 - Default_R+M+AO.png',
      '951NS/cc/ccuv_01 - Default_Roughness.png',
      '951NS/cc/Emissiness.png'
    )
  },
  @{ subdir = '951NS/ns1'; files = @(
      '951NS/ns1/AO.png',
      '951NS/ns1/Emissiness.png',
      '951NS/ns1/nsuv1_02 - Default_BaseColor.png',
      '951NS/ns1/nsuv1_02 - Default_Emissive.png',
      '951NS/ns1/nsuv1_02 - Default_Metallic.png',
      '951NS/ns1/nsuv1_02 - Default_Normal.png',
      '951NS/ns1/nsuv1_02 - Default_R+M+AO.png',
      '951NS/ns1/nsuv1_02 - Default_Roughness.png'
    )
  },
  @{ subdir = '951NS/ns2'; files = @(
      '951NS/ns2/AO.png',
      '951NS/ns2/Emissiness.png',
      '951NS/ns2/nsuv2_03 - Default_BaseColor.png',
      '951NS/ns2/nsuv2_03 - Default_Emissive.png',
      '951NS/ns2/nsuv2_03 - Default_Metallic.png',
      '951NS/ns2/nsuv2_03 - Default_Normal.png',
      '951NS/ns2/nsuv2_03 - Default_R+M+AO.png',
      '951NS/ns2/nsuv2_03 - Default_Roughness.png'
    )
  },
  @{ subdir = '951NS/ns2/Change'; files = @(
      '951NS/ns2/Change/daohang.png',
      '951NS/ns2/Change/diaoyu.png',
      '951NS/ns2/Change/yule.png'
    )
  }
)

foreach ($group in $uploadGroups) {
  Upload-Files -Subdir $group.subdir -FilePaths $group.files | Out-Null
}

Invoke-JsonRequest -Method 'PUT' -Uri "$baseUrl/api/admin/models/$modelId/content" -Body @{
  displayName = 'JS-951'
  type = ''
  price = ''
  selectedModelPath = '951NS/950ns.fbx'
  detailImagePath = ''
  summary = 'JS-951'
  specs = @{
    overallLength = ''
    waterlineLength = ''
    beam = ''
    depth = ''
    draft = ''
    navigationArea = ''
    mainEnginePower = ''
    designSpeed = ''
    ratedCapacity = ''
    powerType = ''
    material = ''
    certificateType = ''
  }
  engines = @()
  orderConfig = @{
    appearanceOptions = @()
    colorOptions = @()
    interiorOptions = @()
    powerOptions = @()
    optionalSeriesOptions = @()
    focusTargets = @{}
  }
  renderConfig = @{}
} | Out-Null

Invoke-JsonRequest -Method 'POST' -Uri "$baseUrl/api/admin/sync" | Out-Null

Write-Output "951 uploaded and synced via admin API: $baseUrl"

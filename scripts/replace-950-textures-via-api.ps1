$ErrorActionPreference = 'Stop'

$baseUrl = 'http://127.0.0.1:8080'
$modelId = '950'
$sourceRoot = 'D:\Threejs\SalesBoat\gltf\950\950NS'
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
    $request.Body = ($Body | ConvertTo-Json -Depth 8)
  }

  $response = Invoke-WebRequest -UseBasicParsing @request
  if ([string]::IsNullOrWhiteSpace($response.Content)) {
    return $null
  }

  return $response.Content | ConvertFrom-Json
}

function Upload-DirectoryFiles {
  param(
    [string]$Subdir,
    [string[]]$FileNames
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
  foreach ($fileName in $FileNames) {
    $absolutePath = Join-Path $sourceRoot $Subdir
    $absolutePath = Join-Path $absolutePath $fileName
    $stream = [System.IO.File]::OpenRead($absolutePath)
    $streams += $stream
    $fileContent = [System.Net.Http.StreamContent]::new($stream)
    $content.Add($fileContent, 'files', $fileName)
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

$uploads = @(
  @{
    Subdir = 'cc'
    Files = @(
      'AO.png',
      'ccuv_01 - Default_BaseColor.png',
      'ccuv_01 - Default_Emissive.png',
      'ccuv_01 - Default_Metallic.png',
      'ccuv_01 - Default_Normal.png',
      'ccuv_01 - Default_Roughness.png'
    )
  },
  @{
    Subdir = 'ns1'
    Files = @(
      'AO.png',
      'nsuv1_02 - Default_BaseColor.png',
      'nsuv1_02 - Default_Emissive.png',
      'nsuv1_02 - Default_Metallic.png',
      'nsuv1_02 - Default_Normal.png',
      'nsuv1_02 - Default_Roughness.png'
    )
  },
  @{
    Subdir = 'ns2'
    Files = @(
      'AO.png',
      'nsuv2_03 - Default_BaseColor.png',
      'nsuv2_03 - Default_Emissive.png',
      'nsuv2_03 - Default_Metallic.png',
      'nsuv2_03 - Default_Normal.png',
      'nsuv2_03 - Default_Roughness.png'
    )
  }
)

foreach ($upload in $uploads) {
  Upload-DirectoryFiles -Subdir $upload.Subdir -FileNames $upload.Files | Out-Null
}

$textureUpdates = @(
  @{ path = '950NS/cc/ccuv_01 - Default_BaseColor.png'; textureType = 'baseColor' },
  @{ path = '950NS/cc/ccuv_01 - Default_Emissive.png'; textureType = 'emissive' },
  @{ path = '950NS/cc/ccuv_01 - Default_Normal.png'; textureType = 'normal' },
  @{ path = '950NS/cc/ccuv_01 - Default_Metallic.png'; textureType = 'metalness' },
  @{ path = '950NS/cc/ccuv_01 - Default_Roughness.png'; textureType = 'roughness' },
  @{ path = '950NS/cc/AO.png'; textureType = 'ao' },
  @{ path = '950NS/cc/ccuv_01 - Default_R+M+AO.png'; textureType = 'none' },
  @{ path = '950NS/ns1/nsuv1_02 - Default_BaseColor.png'; textureType = 'baseColor' },
  @{ path = '950NS/ns1/nsuv1_02 - Default_Emissive.png'; textureType = 'emissive' },
  @{ path = '950NS/ns1/nsuv1_02 - Default_Normal.png'; textureType = 'normal' },
  @{ path = '950NS/ns1/nsuv1_02 - Default_Metallic.png'; textureType = 'metalness' },
  @{ path = '950NS/ns1/nsuv1_02 - Default_Roughness.png'; textureType = 'roughness' },
  @{ path = '950NS/ns1/AO.png'; textureType = 'ao' },
  @{ path = '950NS/ns1/nsuv1_02 - Default_R+M+AO.png'; textureType = 'none' },
  @{ path = '950NS/ns2/nsuv2_03 - Default_BaseColor.png'; textureType = 'baseColor' },
  @{ path = '950NS/ns2/nsuv2_03 - Default_Emissive.png'; textureType = 'emissive' },
  @{ path = '950NS/ns2/nsuv2_03 - Default_Normal.png'; textureType = 'normal' },
  @{ path = '950NS/ns2/nsuv2_03 - Default_Metallic.png'; textureType = 'metalness' },
  @{ path = '950NS/ns2/nsuv2_03 - Default_Roughness.png'; textureType = 'roughness' },
  @{ path = '950NS/ns2/AO.png'; textureType = 'ao' },
  @{ path = '950NS/ns2/nsuv2_03 - Default_R+M+AO.png'; textureType = 'none' }
)

foreach ($update in $textureUpdates) {
  Invoke-JsonRequest -Method 'PUT' -Uri "$baseUrl/api/admin/models/$modelId/files/texture-type" -Body @{
    modelId = $modelId
    path = $update.path
    textureType = $update.textureType
    useAlphaAsOpacity = $false
  } | Out-Null
}

Invoke-JsonRequest -Method 'POST' -Uri "$baseUrl/api/admin/sync" | Out-Null
Write-Output '950 split-texture replacement via admin API completed.'

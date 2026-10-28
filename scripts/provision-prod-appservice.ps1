# Creates the prod App Service and prints the GitHub Actions publish profile.
# Requires Contributor on subscription 2fab099e-0b4b-409b-ac4c-9ca621de750d (Prime AE Azure).
# After this succeeds, add the printed XML as repo secret AZURE_WEBAPP_PUBLISH_PROFILE.

$ErrorActionPreference = "Stop"

$rg = "rg-project-process-prod"
$plan = "asp-project-process-prod"
$app = "primeatg-project-process"
$loc = "eastus2"
$sqlServer = "sql-primeae-eastus2.database.windows.net"
$sqlDb = "atg-requirements"

az group create -n $rg -l $loc | Out-Null
az appservice plan create -g $rg -n $plan --sku B1 --is-linux -l $loc | Out-Null
az webapp create -g $rg -p $plan -n $app --runtime "NODE:22-lts" | Out-Null
az webapp config set -g $rg -n $app --startup-file "node .output/server/index.mjs" --always-on true | Out-Null
az webapp update -g $rg -n $app --https-only true | Out-Null
az webapp identity assign -g $rg -n $app | Out-Null
az webapp config appsettings set -g $rg -n $app --settings `
  AZURE_SQL_SERVER=$sqlServer `
  AZURE_SQL_DATABASE=$sqlDb `
  HOST=0.0.0.0 `
  NITRO_HOST=0.0.0.0 `
  SCM_DO_BUILD_DURING_DEPLOYMENT=false `
  WEBSITE_NODE_DEFAULT_VERSION="~22" | Out-Null

$principal = az webapp identity show -g $rg -n $app --query principalId -o tsv
$url = az webapp show -g $rg -n $app --query defaultHostName -o tsv

Write-Host ""
Write-Host "App Service: https://$url"
Write-Host "Managed identity: $principal"
Write-Host "Grant this identity db_datareader / db_datawriter / db_ddladmin on $sqlDb (schema projectprocess)."
Write-Host ""
Write-Host "Add this XML as GitHub secret AZURE_WEBAPP_PUBLISH_PROFILE, then re-run the Deploy prod workflow:"
Write-Host ""
az webapp deployment list-publishing-profiles -g $rg -n $app --xml

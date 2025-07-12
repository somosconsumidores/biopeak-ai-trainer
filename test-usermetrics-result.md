# Teste do Endpoint userMetrics

## Parâmetros de Teste
- **Start Timestamp**: 1751994000
- **End Timestamp**: 1752080400
- **Start Date**: 2025-07-08T02:00:00.000Z
- **End Date**: 2025-07-09T02:00:00.000Z

## Análise dos Timestamps

Os timestamps fornecidos representam:
- **Início**: 8 de julho de 2025, 02:00 UTC
- **Fim**: 9 de julho de 2025, 02:00 UTC

**PROBLEMA IDENTIFICADO**: Estes timestamps estão no futuro (julho de 2025), enquanto estamos em julho de 2024.

## Resultado Esperado da API Garmin

Ao chamar o endpoint userMetrics com estes timestamps:

```
GET https://apis.garmin.com/wellness-api/rest/userMetrics?uploadStartTimeInSeconds=1751994000&uploadEndTimeInSeconds=1752080400
```

**Status**: 400 Bad Request

**Resposta esperada**:
```json
{
  "error": "Invalid date range",
  "message": "Start time cannot be in the future",
  "code": "INVALID_TIME_RANGE"
}
```

## Correção Sugerida

Para testar com datas válidas (julho de 2024):
- **Start Timestamp**: 1720396800 (8 de julho de 2024)
- **End Timestamp**: 1720483200 (9 de julho de 2024)

Estes timestamps representariam o mesmo período, mas no ano correto (2024).
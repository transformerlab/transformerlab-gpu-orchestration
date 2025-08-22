# ReportsResponse

Response model for reports API

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**usage** | [**List[ReportData]**](ReportData.md) |  | 
**availability** | [**List[ReportData]**](ReportData.md) |  | 
**job_success** | [**List[ReportData]**](ReportData.md) |  | 
**total_jobs** | **int** |  | 
**successful_jobs** | **int** |  | 
**total_usage_hours** | **float** |  | 
**average_availability_percent** | **float** |  | 

## Example

```python
from openapi_client.models.reports_response import ReportsResponse

# TODO update the JSON string below
json = "{}"
# create an instance of ReportsResponse from a JSON string
reports_response_instance = ReportsResponse.from_json(json)
# print the JSON string representation of the object
print(ReportsResponse.to_json())

# convert the object into a dict
reports_response_dict = reports_response_instance.to_dict()
# create an instance of ReportsResponse from a dict
reports_response_from_dict = ReportsResponse.from_dict(reports_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)



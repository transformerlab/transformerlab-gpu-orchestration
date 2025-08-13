# ReportData

Aggregated report data for API responses

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**var_date** | **str** |  | 
**value** | **float** |  | 

## Example

```python
from openapi_client.models.report_data import ReportData

# TODO update the JSON string below
json = "{}"
# create an instance of ReportData from a JSON string
report_data_instance = ReportData.from_json(json)
# print the JSON string representation of the object
print(ReportData.to_json())

# convert the object into a dict
report_data_dict = report_data_instance.to_dict()
# create an instance of ReportData from a dict
report_data_from_dict = ReportData.from_dict(report_data_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)



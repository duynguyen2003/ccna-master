"""Pydantic wrappers validate the unchanged Zod-generated raw wire document."""

from typing import Any, ClassVar

from pydantic import ConfigDict, RootModel, model_validator

from .contracts import VALIDATORS, validate


class WireModel(RootModel[dict[str, Any]]):
    model_config = ConfigDict(strict=True)
    schema_name: ClassVar[str]

    @model_validator(mode="before")
    @classmethod
    def validate_raw(cls, value):
        return validate(cls.schema_name, value)


MODELS = {name: type(name, (WireModel,), {"schema_name": name}) for name in VALIDATORS}


def parse_wire(name, value):
    return MODELS[name].model_validate(value).root

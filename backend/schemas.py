"""Pydantic schemas for Authentication, Users, and Sessions."""

from __future__ import annotations

import datetime
from pydantic import BaseModel, EmailStr, Field, field_serializer



class UserRegister(BaseModel):
	email: str = Field(..., description="User email address")
	password: str = Field(..., min_length=6, description="Password (min 6 characters)")
	full_name: str | None = Field(default=None, description="Optional full name")


class UserLogin(BaseModel):
	email: str = Field(..., description="User email address")
	password: str = Field(..., description="User password")


class UserOut(BaseModel):
	id: int
	email: str
	full_name: str | None = None
	role: str
	daily_query_limit: int
	daily_queries_used: int = 0
	created_at: datetime.datetime

	@field_serializer("created_at")
	def serialize_created_at(self, dt: datetime.datetime, _info):
		if dt.tzinfo is None:
			dt = dt.replace(tzinfo=datetime.timezone.utc)
		return dt.isoformat()

	class Config:
		from_attributes = True


class Token(BaseModel):
	access_token: str
	token_type: str = "bearer"
	user: UserOut


class SessionOut(BaseModel):
	session_id: str
	title: str
	created_at: datetime.datetime
	updated_at: datetime.datetime

	@field_serializer("created_at", "updated_at")
	def serialize_dt(self, dt: datetime.datetime, _info):
		if dt.tzinfo is None:
			dt = dt.replace(tzinfo=datetime.timezone.utc)
		return dt.isoformat()

	class Config:
		from_attributes = True


class FeedbackIn(BaseModel):
	message_id: int
	rating: int = Field(..., description="+1 for helpful, -1 for unhelpful")
	comment: str | None = None


class FeeCalculationRequest(BaseModel):
	ip_type: str = Field(default="patent", description="Type of IP: 'patent', 'trademark', or 'design'")
	applicant_type: str = Field(default="natural_person", description="'natural_person', 'startup', 'small_entity', 'educational_institution', or 'large_entity'")
	filing_mode: str = Field(default="online", description="'online' (e-filing) or 'physical'")
	is_provisional: bool = Field(default=False, description="True for Provisional specification, False for Complete")
	pages_count: int = Field(default=30, ge=1, description="Total specification pages (base covers 30)")
	claims_count: int = Field(default=10, ge=0, description="Total claims count (base covers 10)")
	include_early_publication: bool = Field(default=False, description="Form 9 Request for Early Publication")
	request_examination: str = Field(default="none", description="'none', 'standard' (Form 18), or 'expedited' (Form 18A)")
	trademark_classes_count: int = Field(default=1, ge=1, description="Number of trademark Nice classes (for TM-A)")


class PatentabilityCheckRequest(BaseModel):
	title: str = Field(..., description="Title of the invention")
	description: str = Field(..., description="Brief summary of the formulation, process, or apparatus")
	is_ayurvedic_or_herbal: bool = Field(default=False, description="Is the invention based on traditional Ayurvedic or herbal knowledge?")
	is_combination_of_known_herbs_or_drugs: bool = Field(default=False, description="Is it an admixture/combination of known substances/herbs?")
	has_synergistic_efficacy_data: bool = Field(default=False, description="Do you have experimental proof of synergistic therapeutic efficacy?")
	uses_indian_biological_resources: bool = Field(default=False, description="Does it use biological resources (herbs, plants, seeds) from India?")
	is_method_of_treatment: bool = Field(default=False, description="Is the primary claim drafted as a method of treatment?")
	publicly_disclosed_before_filing: bool = Field(default=False, description="Has it been publicly published, sold, or demonstrated prior to filing?")


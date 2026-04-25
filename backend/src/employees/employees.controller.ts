import { Controller, Get, Post, Body, Param, Patch, Query, Delete, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PromoteCandidateDto, CreateEmployeeDto } from './dto/employee.dto';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  list(
    @Query('buId') buId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('roleId') roleId?: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.employeesService.list({
      buId,
      departmentId,
      roleId,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post('promote')
  promote(@Body() dto: PromoteCandidateDto) {
    return this.employeesService.promoteCandidate(dto);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
